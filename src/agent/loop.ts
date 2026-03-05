import type { AgentContext, AgentResult, Plan } from './types.js';
import { promptSelect } from '../ui/select.js';
import { Planner } from './planner.js';
import { Executor } from './executor.js';
import { ToolExecutor } from '../tools/executor.js';
import { createDefaultRegistry } from '../tools/registry.js';
import { printPlan, printResult } from '../ui/output.js';
import { Spinner } from '../ui/spinner.js';
import { MercuryClient } from '../api/client.js';
import { buildChatSystemPrompt } from './prompts.js';
import { renderMarkdown } from '../ui/markdown.js';
import { logger } from '../ui/logger.js';

export class AgentLoop {
  private planner: Planner;
  private executor: Executor;

  constructor() {
    this.planner = new Planner();
    const toolRegistry = createDefaultRegistry();
    const toolExecutor = new ToolExecutor(toolRegistry);
    this.executor = new Executor(toolExecutor);
  }

  /**
   * Run a single conversational turn. Keeps ctx.messages across calls for history.
   */
  async runTurn(ctx: AgentContext, userPrompt: string): Promise<AgentResult> {
    logger.debug('AgentLoop.runTurn()', userPrompt.slice(0, 80));

    // Update context for this turn
    ctx.userPrompt = userPrompt;
    ctx.observations = [];
    ctx.messages.push({ role: 'user', content: userPrompt });

    // --- PLAN ---
    const planSpinner = new Spinner('Thinking...');
    planSpinner.start();

    let plan: Plan;
    try {
      plan = await this.planner.plan(ctx, planSpinner);
    } catch (err) {
      planSpinner.stop();
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Planner failed: ${msg}`);
      return {
        status: 'error',
        summary: `Planning failed: ${msg}`,
        observations: [],
        iterationsUsed: 0,
      };
    }

    // --- CONVERSATIONAL RESPONSE (no steps needed) ---
    if (plan.steps.length === 0) {
      return this.runChat(ctx);
    }

    // --- AGENTIC EXECUTION ---
    printPlan(plan);

    if (ctx.planMode) {
      const confirm = await confirmPlanExecution();
      if (confirm.action === 'cancel') {
        return { status: 'aborted', summary: 'Plan cancelled by user.', observations: [], iterationsUsed: 0 };
      }
      if (confirm.action === 'redirect') {
        return this.runTurn(ctx, confirm.instruction!);
      }
    }

    ctx.iterationCount++;
    const totalSteps = plan.steps.length;

    for (const step of plan.steps) {
      if (ctx.abortSignal?.aborted) {
        return {
          status: 'aborted',
          summary: 'Aborted by user.',
          observations: ctx.observations,
          iterationsUsed: ctx.iterationCount,
        };
      }

      if (ctx.iterationCount > ctx.maxIterations) {
        const result: AgentResult = {
          status: 'max_iterations',
          summary: `Reached max iterations (${ctx.maxIterations}). Partial work completed.`,
          observations: ctx.observations,
          iterationsUsed: ctx.iterationCount,
        };
        printResult(result);
        return result;
      }

      try {
        const stepObs = await this.executor.executeStep(step, ctx, totalSteps);
        ctx.observations.push(...stepObs);
        ctx.iterationCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Step ${step.id} failed: ${msg}`);

        if (!step.optional) {
          const result: AgentResult = {
            status: 'error',
            summary: `Step [${step.id}] failed: ${msg}`,
            observations: ctx.observations,
            iterationsUsed: ctx.iterationCount,
          };
          printResult(result);
          return result;
        }
        logger.warn(`Optional step ${step.id} failed, continuing.`);
      }
    }

    const result: AgentResult = {
      status: 'success',
      summary: buildSummary(plan, ctx.observations),
      observations: ctx.observations,
      iterationsUsed: ctx.iterationCount,
    };

    printResult(result);
    return result;
  }

  /** Direct conversational response — no tools, just streaming chat. */
  private async runChat(ctx: AgentContext): Promise<AgentResult> {
    const client = new MercuryClient(ctx.apiKey, undefined, ctx.model);
    const spinner = new Spinner('Thinking...');
    spinner.start();

    try {
      let response = '';
      // Strip tool-call artifacts — regular chat models choke on role:'tool' messages
      const chatMessages = ctx.messages.filter(
        (m) =>
          m.role === 'user' ||
          (m.role === 'assistant' && !m.tool_calls && m.content),
      );

      const result = await client.chatStream(
        {
          messages: [
            { role: 'system', content: buildChatSystemPrompt(ctx) },
            ...chatMessages,
          ],
          max_tokens: 2048,
          temperature: 0.7,
        },
        (chunk) => {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) response += delta;
        },
        ctx.abortSignal
      );

      spinner.stop();
      if (!response) response = result.content;
      if (response) {
        process.stdout.write(renderMarkdown(response) + '\n');
        // Store assistant reply in history
        ctx.messages.push({ role: 'assistant', content: response });
      }

      return { status: 'success', summary: '', observations: [], iterationsUsed: 0 };
    } catch (err) {
      spinner.stop();
      const msg = err instanceof Error ? err.message : String(err);
      return { status: 'error', summary: msg, observations: [], iterationsUsed: 0 };
    }
  }

  /** Legacy single-shot run (kept for backwards compat). */
  async run(ctx: AgentContext): Promise<AgentResult> {
    return this.runTurn(ctx, ctx.userPrompt);
  }
}

async function confirmPlanExecution(): Promise<{ action: 'execute' | 'cancel' | 'redirect'; instruction?: string }> {
  const result = await promptSelect(
    '  Execute this plan?',
    ['Execute', 'Cancel'],
    0,
    'Give different instructions...',
  );
  if (result.type === 'cancelled' || (result.type === 'selected' && result.index === 1)) {
    return { action: 'cancel' };
  }
  if (result.type === 'custom') {
    return { action: 'redirect', instruction: result.text };
  }
  return { action: 'execute' };
}

function buildSummary(plan: Plan, observations: AgentContext['observations']): string {
  const successCount = observations.filter((o) => o.result.success).length;
  const totalCount = observations.length;
  if (totalCount === 0) return `Done: ${plan.goal}`;
  return `Done: ${plan.goal} — ${successCount}/${totalCount} tool calls succeeded`;
}

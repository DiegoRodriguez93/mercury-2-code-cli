import type { AgentContext, PlanStep, Observation } from './types.js';
import type { ChatMessage, ToolCallObject } from '../api/types.js';
import { MercuryClient } from '../api/client.js';
import { buildExecutorSystemPrompt, buildStepExecutionPrompt } from './prompts.js';
import { ToolExecutor } from '../tools/executor.js';
import { resolveIntensity } from '../intensity/index.js';
import { printStepStart, printStepDone } from '../ui/output.js';
import { Spinner } from '../ui/spinner.js';
import { renderMarkdown } from '../ui/markdown.js';
import { logger } from '../ui/logger.js';

export class Executor {
  private toolExecutor: ToolExecutor;

  constructor(toolExecutor: ToolExecutor) {
    this.toolExecutor = toolExecutor;
  }

  async executeStep(step: PlanStep, ctx: AgentContext, totalSteps: number): Promise<Observation[]> {
    const client = new MercuryClient(ctx.apiKey, undefined, ctx.model);
    const config = resolveIntensity(ctx.intensity);
    const observations: Observation[] = [];

    printStepStart(step.id, step.description);

    // Each step gets a fresh message window: system + prior context + scoped user message
    const messages: ChatMessage[] = [
      { role: 'system', content: buildExecutorSystemPrompt(ctx) },
      // Include prior conversation context (capped to avoid context bloat)
      ...ctx.messages.slice(-30),
      { role: 'user', content: buildStepExecutionPrompt(step, parseInt(step.id), totalSteps) },
    ];

    const toolRegistry = this.toolExecutor['registry'];
    const tools = toolRegistry.toOpenAITools();

    let iterations = 0;
    const maxStepIterations = Math.min(config.maxIterations, 20);

    while (iterations < maxStepIterations) {
      if (ctx.abortSignal?.aborted) break;
      iterations++;

      let assistantContent = '';
      let toolCalls: ToolCallObject[] = [];

      const spinner = new Spinner('Mercury-2 thinking...');
      spinner.start();

      try {
        const result = await client.chatStream(
          {
            messages,
            tools,
            tool_choice: 'auto',
            max_tokens: config.maxTokens,
            temperature: config.temperature,
          },
          (chunk) => {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) assistantContent += delta;
          },
          ctx.abortSignal
        );

        spinner.stop();

        if (!assistantContent) assistantContent = result.content;
        toolCalls = result.toolCalls;

        // Only print text response when there are no tool calls (final step summary)
        if (assistantContent && toolCalls.length === 0) {
          process.stdout.write(renderMarkdown(assistantContent) + '\n');
        }
      } catch (err) {
        spinner.stop();
        logger.warn(`Stream failed for step ${step.id}, falling back to non-stream: ${err}`);
        const res = await client.chat({
          messages,
          tools,
          tool_choice: 'auto',
          max_tokens: config.maxTokens,
          temperature: config.temperature,
        });
        const choice = res.choices[0];
        assistantContent = choice?.message?.content ?? '';
        toolCalls = choice?.message?.tool_calls ?? [];
      }

      // Append assistant message to both local and shared context
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: assistantContent || null,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      };
      messages.push(assistantMsg);
      ctx.messages.push(assistantMsg);

      // No tool calls → step complete
      if (toolCalls.length === 0) {
        break;
      }

      // Execute each tool call
      for (const tc of toolCalls) {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments) as Record<string, unknown>;
        } catch {
          parsedArgs = { raw: tc.function.arguments };
        }

        const toolCall = { id: tc.id, name: tc.function.name, args: parsedArgs };
        const result = await this.toolExecutor.execute(toolCall, ctx);

        observations.push({
          stepId: step.id,
          toolCall,
          result,
          timestamp: Date.now(),
        });

        const toolMsg: ChatMessage = {
          role: 'tool',
          tool_call_id: tc.id,
          content: result.success
            ? result.output
            : `ERROR: ${result.error ?? result.output}`,
          name: tc.function.name,
        };
        messages.push(toolMsg);
        ctx.messages.push(toolMsg);
      }
    }

    printStepDone(step.id);
    return observations;
  }
}

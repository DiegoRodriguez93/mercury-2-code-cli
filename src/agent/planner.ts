import type { AgentContext, Plan } from './types.js';
import { MercuryClient } from '../api/client.js';
import { buildPlannerSystemPrompt } from './prompts.js';
import { resolveIntensity } from '../intensity/index.js';
import { logger } from '../ui/logger.js';
import type { Spinner } from '../ui/spinner.js';

export class Planner {
  async plan(ctx: AgentContext, spinner?: Spinner): Promise<Plan> {
    const client = new MercuryClient(ctx.apiKey, undefined, ctx.model);
    const config = resolveIntensity(ctx.intensity);
    const systemPrompt = buildPlannerSystemPrompt(ctx);

    logger.debug('Planning...');

    // Include recent user/assistant turns so the planner can resolve references like
    // "it", "the file", "the previous task", etc. Strip tool-call artifacts.
    const contextMessages = ctx.messages
      .slice(0, -1) // exclude the current user message (added to ctx just before planning)
      .filter(
        (m) =>
          m.role === 'user' ||
          (m.role === 'assistant' && !m.tool_calls && typeof m.content === 'string' && m.content),
      )
      .slice(-6);

    const plannerMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...contextMessages,
      { role: 'user' as const, content: ctx.userPrompt },
    ];

    let rawJson = '';

    try {
      const result = await client.chatStream(
        {
          messages: plannerMessages,
          max_tokens: Math.min(config.maxTokens, 2048),
          temperature: config.temperature,
        },
        (chunk) => {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) rawJson += delta;
        },
        ctx.abortSignal
      );

      spinner?.stop();
      const json = rawJson || result.content;
      const plan = parsePlan(json);
      logger.debug('Plan parsed:', JSON.stringify(plan));
      return plan;
    } catch (err) {
      spinner?.stop();
      logger.warn(`Planner streaming failed, trying non-streaming: ${err}`);
      const res = await client.chat({
        messages: plannerMessages,
        max_tokens: Math.min(config.maxTokens, 2048),
        temperature: config.temperature,
      });
      const content = res.choices[0]?.message?.content ?? '{}';
      return parsePlan(content);
    }
  }
}

function parsePlan(raw: string): Plan {
  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();

  try {
    const parsed = JSON.parse(cleaned) as Partial<Plan>;
    return {
      goal: parsed.goal ?? 'Complete task',
      rationale: parsed.rationale ?? '',
      steps: Array.isArray(parsed.steps)
        ? parsed.steps.map((s, i) => ({
            id: String(s.id ?? i + 1),
            description: s.description ?? `Step ${i + 1}`,
            toolHints: s.toolHints ?? [],
            dependsOn: s.dependsOn ?? [],
            optional: s.optional ?? false,
          }))
        : [{ id: '1', description: 'Execute the task', toolHints: [], dependsOn: [], optional: false }],
    };
  } catch {
    logger.warn('Failed to parse plan JSON, using fallback single-step plan');
    return {
      goal: 'Complete task',
      rationale: 'Could not parse structured plan; proceeding with single execution step.',
      steps: [
        { id: '1', description: 'Execute the task', toolHints: [], dependsOn: [], optional: false },
      ],
    };
  }
}

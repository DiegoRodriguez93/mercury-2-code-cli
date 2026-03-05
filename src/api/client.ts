import { API_ENDPOINT, DEFAULT_MODEL } from '../config/constants.js';
import { parseSSEStream } from './stream.js';
import type { ChatRequest, ChatResponse, StreamChunk, ToolCallObject } from './types.js';
import { logger } from '../ui/logger.js';

export interface StreamResult {
  content: string;
  toolCalls: ToolCallObject[];
  finishReason: string | null;
}

export class MercuryClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(apiKey: string, baseUrl = API_ENDPOINT, model = DEFAULT_MODEL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async chat(request: Omit<ChatRequest, 'model' | 'stream'>): Promise<ChatResponse> {
    const body: ChatRequest = { ...request, model: this.model, stream: false };
    logger.debug('POST /chat/completions', JSON.stringify(body).slice(0, 200));

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Mercury API error ${res.status}: ${text}`);
    }

    return res.json() as Promise<ChatResponse>;
  }

  async chatStream(
    request: Omit<ChatRequest, 'model' | 'stream'>,
    onChunk?: (chunk: StreamChunk) => void,
    signal?: AbortSignal
  ): Promise<StreamResult> {
    const body: ChatRequest = { ...request, model: this.model, stream: true };
    logger.debug('POST /chat/completions (stream)', JSON.stringify(body).slice(0, 200));

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Mercury API error ${res.status}: ${text}`);
    }

    let content = '';
    let finishReason: string | null = null;
    // Accumulate tool calls by index
    const toolCallAccum: Map<
      number,
      { id: string; name: string; argumentsRaw: string }
    > = new Map();

    for await (const chunk of parseSSEStream(res, signal)) {
      onChunk?.(chunk);
      const choice = chunk.choices[0];
      if (!choice) continue;

      if (choice.finish_reason) finishReason = choice.finish_reason;

      const delta = choice.delta;
      if (delta.content) content += delta.content;

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const existing = toolCallAccum.get(tc.index);
          if (!existing) {
            toolCallAccum.set(tc.index, {
              id: tc.id ?? `call_${tc.index}`,
              name: tc.function?.name ?? '',
              argumentsRaw: tc.function?.arguments ?? '',
            });
          } else {
            if (tc.function?.name) existing.name += tc.function.name;
            if (tc.function?.arguments) existing.argumentsRaw += tc.function.arguments;
          }
        }
      }
    }

    const toolCalls: ToolCallObject[] = Array.from(toolCallAccum.entries())
      .sort(([a], [b]) => a - b)
      .map(([, v]) => ({
        id: v.id,
        type: 'function' as const,
        function: { name: v.name, arguments: v.argumentsRaw },
      }));

    return { content, toolCalls, finishReason };
  }
}

export interface ToolCallObject {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCallObject[];
  name?: string;
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  tools?: OpenAITool[];
  tool_choice?: 'auto' | 'none' | 'required';
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ChatResponseMessage {
  role: 'assistant';
  content: string | null;
  tool_calls?: ToolCallObject[];
}

export interface ChatResponseChoice {
  index: number;
  message: ChatResponseMessage;
  finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | null;
}

export interface ChatResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatResponseChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface StreamDelta {
  role?: 'assistant';
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: 'function';
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

export interface StreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: StreamDelta;
    finish_reason: 'stop' | 'tool_calls' | 'length' | null;
  }>;
}

export type DangerLevel = 'safe' | 'moderate' | 'high';

export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  description?: string;
  enum?: unknown[];
  default?: unknown;
  additionalProperties?: boolean | JSONSchema;
  [key: string]: unknown;
}

export interface ToolContext {
  workingDir: string;
  yolo: boolean;
}

export interface Tool {
  name: string;
  description: string;
  schema: JSONSchema;
  requiresConfirmation: boolean;
  dangerLevel: DangerLevel;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };
}

import type { ChatMessage } from '../api/types.js';
import type { ToolCall, ToolResult } from '../tools/types.js';
import type { IntensityMode } from '../intensity/types.js';

export interface PlanStep {
  id: string;
  description: string;
  toolHints?: string[];
  dependsOn?: string[];
  optional?: boolean;
}

export interface Plan {
  goal: string;
  rationale: string;
  steps: PlanStep[];
}

export interface Observation {
  stepId: string;
  toolCall: ToolCall;
  result: ToolResult;
  timestamp: number;
}

export interface AgentContext {
  userPrompt: string;
  workingDir: string;
  messages: ChatMessage[];
  observations: Observation[];
  iterationCount: number;
  maxIterations: number;
  yolo: boolean;
  planMode: boolean;
  intensity: IntensityMode;
  apiKey: string;
  model: string;
  abortSignal?: AbortSignal;
}

export type AgentStatus = 'success' | 'error' | 'aborted' | 'max_iterations';

export interface AgentResult {
  status: AgentStatus;
  summary: string;
  observations: Observation[];
  iterationsUsed: number;
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

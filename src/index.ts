// Public API exports
export { AgentLoop } from './agent/loop.js';
export { buildDefaultContext } from './agent/context.js';
export { MercuryClient } from './api/client.js';
export { resolveApiKey } from './auth/index.js';
export { resolveIntensity } from './intensity/index.js';
export { createDefaultRegistry } from './tools/registry.js';
export { ToolRegistry } from './tools/registry.js';
export { SkillRegistry, createDefaultSkillRegistry } from './skills/registry.js';

export type { AgentContext, AgentResult, Plan, PlanStep, Observation } from './agent/types.js';
export type { MercuryConfig } from './config/types.js';
export type { IntensityMode, IntensityConfig } from './intensity/types.js';
export type { Tool, ToolCall, ToolResult } from './tools/types.js';
export type { ChatMessage, ChatRequest, ChatResponse, StreamChunk } from './api/types.js';

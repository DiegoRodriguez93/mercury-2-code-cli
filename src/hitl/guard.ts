import type { Tool, ToolCall } from '../tools/types.js';
import type { AgentContext } from '../agent/types.js';

export class HITLGuard {
  shouldConfirm(tool: Tool, _call: ToolCall, ctx: AgentContext): boolean {
    if (ctx.yolo) return false;
    return tool.requiresConfirmation;
  }
}

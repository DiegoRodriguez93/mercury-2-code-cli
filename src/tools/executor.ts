import type { ToolCall, ToolResult, ToolContext } from './types.js';
import type { ToolRegistry } from './registry.js';
import type { AgentContext } from '../agent/types.js';
import { HITLGuard } from '../hitl/guard.js';
import { confirmAction } from '../hitl/prompt.js';
import { printToolCall } from '../ui/output.js';
import { logger } from '../ui/logger.js';

export class ToolExecutor {
  private registry: ToolRegistry;
  private guard: HITLGuard;

  constructor(registry: ToolRegistry) {
    this.registry = registry;
    this.guard = new HITLGuard();
  }

  async execute(call: ToolCall, agentCtx: AgentContext): Promise<ToolResult> {
    const tool = this.registry.get(call.name);
    if (!tool) {
      return { success: false, output: '', error: `Unknown tool: ${call.name}` };
    }

    printToolCall(call.name, call.args);

    // HITL check
    if (this.guard.shouldConfirm(tool, call, agentCtx)) {
      const decision = await confirmAction(tool, call, agentCtx);
      if (decision === 'no') {
        return {
          success: false,
          output: '',
          error: `User declined to execute tool: ${call.name}`,
        };
      }
    }

    const toolCtx: ToolContext = {
      workingDir: agentCtx.workingDir,
      yolo: agentCtx.yolo,
    };

    logger.debug(`Executing tool ${call.name}`, JSON.stringify(call.args).slice(0, 200));

    try {
      const result = await tool.execute(call.args, toolCtx);
      logger.debug(`Tool ${call.name} result: success=${result.success}`, result.output.slice(0, 100));
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Tool ${call.name} threw: ${msg}`);
      return { success: false, output: '', error: msg };
    }
  }
}

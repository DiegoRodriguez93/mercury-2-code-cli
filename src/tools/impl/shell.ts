import { execSync } from 'child_process';
import type { Tool, ToolResult, ToolContext } from '../types.js';

export const shellTool: Tool = {
  name: 'shell',
  description:
    'Execute a shell command in the working directory. ' +
    'Returns stdout and stderr combined. Use for running scripts, tests, builds, etc.',
  requiresConfirmation: true,
  dangerLevel: 'high',
  schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
      timeout_ms: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 30000)',
      },
    },
    required: ['command'],
  },
  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const command = String(args['command']);
    const timeout = typeof args['timeout_ms'] === 'number' ? args['timeout_ms'] : 30000;

    try {
      const output = execSync(command, {
        cwd: ctx.workingDir,
        timeout,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { success: true, output: output.toString() };
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      const combined = [e.stdout, e.stderr, e.message].filter(Boolean).join('\n');
      return { success: false, output: combined, error: combined };
    }
  },
};

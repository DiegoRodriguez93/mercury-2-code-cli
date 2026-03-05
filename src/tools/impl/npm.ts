import { execSync } from 'child_process';
import { resolve } from 'path';
import type { Tool, ToolResult, ToolContext } from '../types.js';

type NpmOperation = 'install' | 'run' | 'test' | 'build' | 'lint' | 'list' | 'audit';

export const npmTool: Tool = {
  name: 'npm',
  description:
    'Run npm/node script operations in the specified directory. ' +
    'Supported operations: install, run <script>, test, build, lint, list, audit. ' +
    'IMPORTANT: Always specify "cwd" to run npm in the target project directory, not the agent working directory.',
  requiresConfirmation: true,
  dangerLevel: 'moderate',
  schema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['install', 'run', 'test', 'build', 'lint', 'list', 'audit'],
        description: 'npm operation to run',
      },
      script: {
        type: 'string',
        description: 'Script name (required when operation is "run")',
      },
      args: { type: 'string', description: 'Additional arguments (e.g. package names for install)' },
      cwd: {
        type: 'string',
        description: 'Directory to run npm in. Defaults to agent working directory. Set explicitly to avoid running in the wrong project.',
      },
    },
    required: ['operation'],
  },
  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const op = String(args['operation']) as NpmOperation;
    const script = args['script'] ? String(args['script']) : '';
    const extra = args['args'] ? String(args['args']) : '';
    const runDir = args['cwd']
      ? resolve(ctx.workingDir, String(args['cwd']))
      : ctx.workingDir;

    let cmd: string;
    switch (op) {
      case 'run':
        if (!script) return { success: false, output: '', error: '"script" is required for npm run' };
        cmd = `npm run ${script} ${extra}`.trim();
        break;
      case 'install':
        cmd = `npm install ${extra}`.trim();
        break;
      default:
        cmd = `npm ${op} ${extra}`.trim();
    }

    try {
      const output = execSync(cmd, {
        cwd: runDir,
        encoding: 'utf-8',
        timeout: 120000,
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

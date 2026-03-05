import { execSync } from 'child_process';
import type { Tool, ToolResult, ToolContext } from '../types.js';

type GitOperation =
  | 'status'
  | 'diff'
  | 'log'
  | 'add'
  | 'commit'
  | 'branch'
  | 'checkout'
  | 'stash'
  | 'show';

const SAFE_OPS: GitOperation[] = ['status', 'diff', 'log', 'show'];
const WRITE_OPS: GitOperation[] = ['add', 'commit', 'branch', 'checkout', 'stash'];

export const gitTool: Tool = {
  name: 'git',
  description:
    'Run git operations in the working directory. ' +
    `Safe ops (no confirm): ${SAFE_OPS.join(', ')}. ` +
    `Write ops (confirm required): ${WRITE_OPS.join(', ')}.`,
  requiresConfirmation: false, // overridden dynamically per operation below
  dangerLevel: 'moderate',
  schema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [...SAFE_OPS, ...WRITE_OPS],
        description: 'Git operation to run',
      },
      args: { type: 'string', description: 'Additional git arguments (e.g. "-m \'fix bug\'"' },
    },
    required: ['operation'],
  },
  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const op = String(args['operation']) as GitOperation;
    const extraArgs = args['args'] ? String(args['args']) : '';
    const cmd = `git ${op} ${extraArgs}`.trim();

    try {
      const output = execSync(cmd, {
        cwd: ctx.workingDir,
        encoding: 'utf-8',
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { success: true, output: output.toString().trim() };
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      const combined = [e.stdout, e.stderr, e.message].filter(Boolean).join('\n');
      return { success: false, output: combined, error: combined };
    }
  },
};

// Write operations need confirmation — patch at runtime
const originalExecute = gitTool.execute.bind(gitTool);
gitTool.execute = async (args, ctx) => {
  const op = String(args['operation']);
  if (WRITE_OPS.includes(op as GitOperation)) {
    gitTool.requiresConfirmation = true;
  } else {
    gitTool.requiresConfirmation = false;
  }
  return originalExecute(args, ctx);
};

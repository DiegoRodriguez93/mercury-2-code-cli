import { execSync } from 'child_process';
import { resolve } from 'path';
import type { Tool, ToolResult, ToolContext } from '../types.js';

export const globTool: Tool = {
  name: 'glob',
  description: 'Find files matching a glob pattern. Returns a list of matching file paths.',
  requiresConfirmation: false,
  dangerLevel: 'safe',
  schema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern (e.g. "**/*.ts", "src/*.js")' },
      cwd: {
        type: 'string',
        description: 'Directory to search in (default: working directory)',
      },
      max_results: { type: 'number', description: 'Maximum number of results (default: 100)' },
    },
    required: ['pattern'],
  },
  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const pattern = String(args['pattern']);
    const searchCwd = args['cwd']
      ? resolve(ctx.workingDir, String(args['cwd']))
      : ctx.workingDir;
    const maxResults = typeof args['max_results'] === 'number' ? args['max_results'] : 100;

    // Use find with glob to avoid depending on bash globstar
    const cmd = `find ${JSON.stringify(searchCwd)} -path ${JSON.stringify('*/' + pattern.replace(/^\*\*\//, ''))} -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -${maxResults}`;

    try {
      const output = execSync(cmd, { cwd: searchCwd, encoding: 'utf-8', timeout: 10000 });
      const lines = output.trim().split('\n').filter(Boolean);
      if (lines.length === 0) return { success: true, output: '(no matches)' };
      return { success: true, output: lines.join('\n') };
    } catch (err: unknown) {
      const e = err as { message?: string };
      return { success: false, output: '', error: e.message };
    }
  },
};

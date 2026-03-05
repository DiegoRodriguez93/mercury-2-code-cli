import { execSync } from 'child_process';
import { resolve } from 'path';
import type { Tool, ToolResult, ToolContext } from '../types.js';

export const grepTool: Tool = {
  name: 'grep',
  description: 'Search file contents using a pattern. Returns matching lines with file/line info.',
  requiresConfirmation: false,
  dangerLevel: 'safe',
  schema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Search pattern (regex supported)' },
      path: {
        type: 'string',
        description: 'File or directory to search in (default: current dir)',
      },
      recursive: {
        type: 'boolean',
        description: 'Search recursively in directories (default: true)',
      },
      case_insensitive: { type: 'boolean', description: 'Case-insensitive search' },
      max_results: { type: 'number', description: 'Maximum number of results (default: 50)' },
    },
    required: ['pattern'],
  },
  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const pattern = String(args['pattern']);
    const searchPath = args['path']
      ? resolve(ctx.workingDir, String(args['path']))
      : ctx.workingDir;
    const recursive = args['recursive'] !== false;
    const caseInsensitive = args['case_insensitive'] === true;
    const maxResults = typeof args['max_results'] === 'number' ? args['max_results'] : 50;

    const flags = [
      '-n', // line numbers
      '--include=*.{ts,js,tsx,jsx,json,md,py,go,rs,java,c,cpp,h,css,html,yaml,yml,toml,sh}',
      recursive ? '-r' : '',
      caseInsensitive ? '-i' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const cmd = `grep ${flags} -m ${maxResults} -E ${JSON.stringify(pattern)} ${JSON.stringify(searchPath)} 2>/dev/null || true`;

    try {
      const output = execSync(cmd, { cwd: ctx.workingDir, encoding: 'utf-8', timeout: 10000 });
      return { success: true, output: output.trim() || '(no matches)' };
    } catch (err: unknown) {
      const e = err as { message?: string };
      return { success: false, output: '', error: e.message };
    }
  },
};

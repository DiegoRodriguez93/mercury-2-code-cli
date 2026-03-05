import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import type { Tool, ToolResult, ToolContext } from '../types.js';

export const writeTool: Tool = {
  name: 'write_file',
  description: 'Write content to a file. Creates the file and parent directories if needed. Overwrites existing content.',
  requiresConfirmation: true,
  dangerLevel: 'moderate',
  schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to write' },
      content: { type: 'string', description: 'Content to write to the file' },
    },
    required: ['path', 'content'],
  },
  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const filePath = resolve(ctx.workingDir, String(args['path']));
    const content = String(args['content']);

    const dir = dirname(filePath);
    mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, content, 'utf-8');
    return { success: true, output: `Written ${content.length} bytes to ${filePath}` };
  },
};

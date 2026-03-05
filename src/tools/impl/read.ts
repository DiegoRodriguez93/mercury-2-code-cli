import { readFileSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';
import type { Tool, ToolResult, ToolContext } from '../types.js';

export const readTool: Tool = {
  name: 'read_file',
  description: 'Read the contents of a file. Returns the file content as a string.',
  requiresConfirmation: false,
  dangerLevel: 'safe',
  schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or relative path to the file to read' },
      start_line: { type: 'number', description: 'Optional: first line to read (1-indexed)' },
      end_line: { type: 'number', description: 'Optional: last line to read (inclusive)' },
    },
    required: ['path'],
  },
  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const filePath = resolve(ctx.workingDir, String(args['path']));
    if (!existsSync(filePath)) {
      return { success: false, output: '', error: `File not found: ${filePath}` };
    }
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      return { success: false, output: '', error: `Path is a directory: ${filePath}` };
    }
    if (stat.size > 5 * 1024 * 1024) {
      return { success: false, output: '', error: `File too large (>5MB): ${filePath}` };
    }

    const content = readFileSync(filePath, 'utf-8');
    const startLine = typeof args['start_line'] === 'number' ? args['start_line'] : undefined;
    const endLine = typeof args['end_line'] === 'number' ? args['end_line'] : undefined;

    if (startLine !== undefined || endLine !== undefined) {
      const lines = content.split('\n');
      const start = (startLine ?? 1) - 1;
      const end = endLine ?? lines.length;
      return { success: true, output: lines.slice(start, end).join('\n') };
    }

    return { success: true, output: content };
  },
};

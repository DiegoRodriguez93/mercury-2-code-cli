import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { Tool, ToolResult, ToolContext } from '../types.js';

export const editTool: Tool = {
  name: 'edit_file',
  description:
    'Edit a file by replacing an exact string block with new content. ' +
    'old_string must match exactly (including whitespace/indentation). ' +
    'Use read_file first to get the exact content.',
  requiresConfirmation: true,
  dangerLevel: 'moderate',
  schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to edit' },
      old_string: { type: 'string', description: 'Exact string to replace (must match exactly)' },
      new_string: { type: 'string', description: 'Replacement string' },
    },
    required: ['path', 'old_string', 'new_string'],
  },
  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const filePath = resolve(ctx.workingDir, String(args['path']));
    const oldString = String(args['old_string']);
    const newString = String(args['new_string']);

    if (!existsSync(filePath)) {
      return { success: false, output: '', error: `File not found: ${filePath}` };
    }

    const content = readFileSync(filePath, 'utf-8');
    if (!content.includes(oldString)) {
      return {
        success: false,
        output: '',
        error: `old_string not found in ${filePath}. Use read_file to get exact content first.`,
      };
    }

    const updated = content.replace(oldString, newString);
    writeFileSync(filePath, updated, 'utf-8');
    return { success: true, output: `Edited ${filePath}` };
  },
};

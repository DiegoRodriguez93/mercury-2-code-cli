import type { Tool, OpenAITool } from './types.js';
import { readTool } from './impl/read.js';
import { writeTool } from './impl/write.js';
import { editTool } from './impl/edit.js';
import { shellTool } from './impl/shell.js';
import { grepTool } from './impl/grep.js';
import { globTool } from './impl/glob.js';
import { gitTool } from './impl/git.js';
import { npmTool } from './impl/npm.js';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  all(): Tool[] {
    return Array.from(this.tools.values());
  }

  toOpenAITools(): OpenAITool[] {
    return this.all().map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.schema,
      },
    }));
  }
}

export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(readTool);
  registry.register(writeTool);
  registry.register(editTool);
  registry.register(shellTool);
  registry.register(grepTool);
  registry.register(globTool);
  registry.register(gitTool);
  registry.register(npmTool);
  return registry;
}

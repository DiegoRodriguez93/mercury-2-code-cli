import type { Skill } from './types.js';
import type { ToolRegistry } from '../tools/registry.js';
import { filesystemSkill } from './builtin/filesystem.js';
import { shellSkill } from './builtin/shell.js';
import { searchSkill } from './builtin/search.js';
import { vcsSkill } from './builtin/vcs.js';

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  register(skill: Skill): void {
    this.skills.set(skill.name, skill);
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  all(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Register all tools from all skills into a ToolRegistry.
   */
  populateToolRegistry(toolRegistry: ToolRegistry): void {
    for (const skill of this.all()) {
      for (const tool of skill.tools) {
        toolRegistry.register(tool);
      }
    }
  }
}

export function createDefaultSkillRegistry(): SkillRegistry {
  const registry = new SkillRegistry();
  registry.register(filesystemSkill);
  registry.register(shellSkill);
  registry.register(searchSkill);
  registry.register(vcsSkill);
  return registry;
}

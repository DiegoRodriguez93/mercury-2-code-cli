import type { Skill } from '../types.js';
import { gitTool } from '../../tools/impl/git.js';

export const vcsSkill: Skill = {
  name: 'vcs',
  description: 'Git version control operations',
  tools: [gitTool],
};

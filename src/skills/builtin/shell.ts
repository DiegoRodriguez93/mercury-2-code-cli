import type { Skill } from '../types.js';
import { shellTool } from '../../tools/impl/shell.js';
import { npmTool } from '../../tools/impl/npm.js';

export const shellSkill: Skill = {
  name: 'shell',
  description: 'Execute shell commands and npm scripts',
  tools: [shellTool, npmTool],
};

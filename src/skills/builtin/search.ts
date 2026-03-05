import type { Skill } from '../types.js';
import { grepTool } from '../../tools/impl/grep.js';
import { globTool } from '../../tools/impl/glob.js';

export const searchSkill: Skill = {
  name: 'search',
  description: 'Search file contents with grep and find files with glob',
  tools: [grepTool, globTool],
};

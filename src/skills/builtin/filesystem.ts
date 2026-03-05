import type { Skill } from '../types.js';
import { readTool } from '../../tools/impl/read.js';
import { writeTool } from '../../tools/impl/write.js';
import { editTool } from '../../tools/impl/edit.js';
import { globTool } from '../../tools/impl/glob.js';

export const filesystemSkill: Skill = {
  name: 'filesystem',
  description: 'Read, write, edit, and search files on disk',
  tools: [readTool, writeTool, editTool, globTool],
};

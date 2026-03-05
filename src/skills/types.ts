import type { Tool } from '../tools/types.js';

export interface Skill {
  name: string;
  description: string;
  tools: Tool[];
}

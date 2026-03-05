import type { IntensityMode, IntensityConfig } from './types.js';

const CONFIGS: Record<IntensityMode, IntensityConfig> = {
  low: {
    mode: 'low',
    maxTokens: 2048,
    maxIterations: 3,
    temperature: 0.3,
    systemPromptAddendum: 'Be concise. Minimal tool calls. Prefer direct solutions.',
  },
  medium: {
    mode: 'medium',
    maxTokens: 8192,
    maxIterations: 7,
    temperature: 0.5,
    systemPromptAddendum: 'Balance thoroughness and efficiency.',
  },
  high: {
    mode: 'high',
    maxTokens: 16384,
    maxIterations: 15,
    temperature: 0.7,
    systemPromptAddendum: 'Be thorough. Write tests. Verify your work. Handle edge cases.',
  },
  auto: {
    mode: 'auto',
    maxTokens: 8192,
    maxIterations: 10,
    temperature: 0.5,
    systemPromptAddendum: 'Calibrate your approach to task complexity.',
  },
};

export function resolveIntensity(mode: IntensityMode): IntensityConfig {
  return CONFIGS[mode] ?? CONFIGS['auto'];
}

export type { IntensityMode, IntensityConfig };

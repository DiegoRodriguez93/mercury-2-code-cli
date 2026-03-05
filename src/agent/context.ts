import type { AgentContext } from './types.js';
import type { IntensityMode } from '../intensity/types.js';
import { resolveIntensity } from '../intensity/index.js';

export interface BuildContextOptions {
  userPrompt: string;
  workingDir?: string;
  yolo?: boolean;
  planMode?: boolean;
  intensity?: IntensityMode;
  maxIterations?: number;
  model?: string;
  apiKey: string;
  abortSignal?: AbortSignal;
}

export function buildDefaultContext(opts: BuildContextOptions): AgentContext {
  const intensity = opts.intensity ?? 'auto';
  const config = resolveIntensity(intensity);

  return {
    userPrompt: opts.userPrompt,
    workingDir: opts.workingDir ?? process.cwd(),
    messages: [],
    observations: [],
    iterationCount: 0,
    maxIterations: opts.maxIterations ?? config.maxIterations,
    yolo: opts.yolo ?? false,
    planMode: opts.planMode ?? false,
    intensity,
    apiKey: opts.apiKey,
    model: opts.model ?? 'mercury-2',
    abortSignal: opts.abortSignal,
  };
}

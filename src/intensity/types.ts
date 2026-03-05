export type IntensityMode = 'low' | 'medium' | 'high' | 'auto';

export interface IntensityConfig {
  mode: IntensityMode;
  maxTokens: number;
  maxIterations: number;
  temperature: number;
  systemPromptAddendum: string;
}

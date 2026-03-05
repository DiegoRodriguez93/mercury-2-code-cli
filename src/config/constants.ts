import { homedir } from 'os';
import { join } from 'path';

export const API_ENDPOINT = 'https://api.inceptionlabs.ai/v1';
export const DEFAULT_MODEL = 'mercury-2';
export const CONFIG_DIR = join(homedir(), '.mercury2');
export const CONFIG_PATH = join(CONFIG_DIR, 'config.json');
export const DEFAULT_MAX_TOKENS = 8192;
export const DEFAULT_MAX_ITERATIONS = 10;
export const DEFAULT_TEMPERATURE = 0.5;

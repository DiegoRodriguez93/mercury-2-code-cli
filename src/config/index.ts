import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'fs';
import { CONFIG_DIR, CONFIG_PATH } from './constants.js';
import type { MercuryConfig } from './types.js';

export function loadConfig(): MercuryConfig {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as MercuryConfig;
  } catch {
    return {};
  }
}

export function saveConfig(config: MercuryConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  try {
    chmodSync(CONFIG_PATH, 0o600);
  } catch {
    // best-effort chmod
  }
}

export { CONFIG_PATH, CONFIG_DIR };
export type { MercuryConfig };

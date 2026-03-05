import { createInterface } from 'readline';
import { loadConfig, saveConfig } from '../config/index.js';

export async function resolveApiKey(): Promise<string> {
  // 1. Environment variable
  if (process.env['INCEPTION_API_KEY']) {
    return process.env['INCEPTION_API_KEY'];
  }

  // 2. Config file
  const config = loadConfig();
  if (config.apiKey) {
    return config.apiKey;
  }

  // 3. Interactive prompt
  const key = await promptForApiKey();
  if (!key) {
    throw new Error('INCEPTION_API_KEY is required. Set it via env var or provide it when prompted.');
  }

  // Save for future use
  saveConfig({ ...config, apiKey: key });
  console.error('API key saved to ~/.mercury2/config.json (chmod 600)');
  return key;
}

function promptForApiKey(): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    rl.question('Enter your Inception Labs API key (INCEPTION_API_KEY): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

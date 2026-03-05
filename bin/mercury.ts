#!/usr/bin/env node

import { createInterface } from 'readline';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { parseArgs, printHelp } from '../src/cli/args.js';
import { resolveApiKey } from '../src/auth/index.js';
import { AgentLoop } from '../src/agent/loop.js';
import { buildDefaultContext } from '../src/agent/context.js';
import { printBanner, printError, colors } from '../src/ui/output.js';
import { logger } from '../src/ui/logger.js';
import { resolveIntensity } from '../src/intensity/index.js';
import type { IntensityMode } from '../src/intensity/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8')
) as { version: string };
const VERSION = pkg.version;

// ── helpers ────────────────────────────────────────────────────────────────

function c(code: string, text: string): string {
  if (!process.stdout.isTTY) return text;
  return `${code}${text}${colors.reset}`;
}

function writePromptHeader(planMode: boolean): void {
  if (!process.stdout.isTTY) return;
  const width = process.stdout.columns ?? 80;
  const bar = c(colors.gray, '─'.repeat(width));
  const planHint = planMode
    ? c(colors.cyan, 'Shift+Tab') + c(colors.gray, ': plan mode ON')
    : c(colors.dim, 'Shift+Tab') + c(colors.gray, ': plan mode');
  const hint = `  ${planHint}  ${c(colors.dim, '·')}  ${c(colors.dim, '/help for commands')}`;
  process.stdout.write(`${bar}\n${hint}\n`);
}

function promptLine(cwd: string, intensity: string, yolo: boolean, planMode: boolean): string {
  if (!process.stdout.isTTY) return 'mercury > ';
  const short = cwd.replace(process.env['HOME'] ?? '', '~');
  const planBadge = planMode ? c(colors.cyan, ' [plan]') : '';
  const yoloBadge = yolo ? c(colors.yellow, ' YOLO') : '';
  return (
    c(colors.cyan, 'mercury') +
    c(colors.gray, ` ${short}`) +
    c(colors.dim, ` [${intensity}]`) +
    planBadge +
    yoloBadge +
    c(colors.bold, ' ❯ ')
  );
}

const EXIT_COMMANDS = new Set(['exit', 'quit', '/exit', '/quit', 'q']);

// ── main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);

  if (opts.debug) process.env['DEBUG'] = 'mercury';

  if (opts.version) {
    process.stdout.write(`mercury-2-code-cli v${VERSION}\n`);
    process.exit(0);
  }

  if (opts.help) {
    printHelp(VERSION);
    process.exit(0);
  }

  // Resolve API key before printing banner
  let apiKey: string;
  try {
    apiKey = await resolveApiKey();
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Set up abort on Ctrl+C — in REPL mode we want a graceful exit
  const abortController = new AbortController();
  let aborting = false;
  process.on('SIGINT', () => {
    if (aborting) process.exit(1);
    aborting = true;
    process.stderr.write('\n\x1b[33m(Ctrl+C — type "exit" to quit)\x1b[0m\n');
    abortController.abort();
    // Reset for next turn
    setTimeout(() => { aborting = false; }, 2000);
  });

  // Build a persistent context — messages accumulate across turns
  const context = buildDefaultContext({
    userPrompt: '',
    workingDir: opts.cwd,
    yolo: opts.yolo,
    planMode: opts.plan,
    intensity: opts.intensity,
    maxIterations: opts.maxIter,
    model: opts.model,
    apiKey,
    abortSignal: abortController.signal,
  });

  printBanner(VERSION, context.model, context.intensity, context.workingDir, context.yolo);

  const loop = new AgentLoop();

  // ── Single-shot mode (prompt passed as CLI arg) ───────────────────────
  if (opts.prompt) {
    logger.debug('Single-shot mode');
    try {
      const result = await loop.runTurn(context, opts.prompt);
      process.exit(result.status === 'success' ? 0 : 1);
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
    return;
  }

  // ── Interactive REPL mode ─────────────────────────────────────────────
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: process.stdin.isTTY,
  });

  let rlClosed = false;
  rl.on('close', () => { rlClosed = true; });

  // Shift+Tab detection via raw stdin data (\x1b[Z)
  process.stdin.on('data', (buf: Buffer) => {
    if (buf.toString() === '\x1b[Z') {
      context.planMode = !context.planMode;
      const state = context.planMode ? 'ON' : 'OFF';
      process.stdout.write(`\r\n${c(colors.cyan, `  Plan mode ${state}`)}\n`);
    }
  });

  const askLine = (): Promise<string | null> =>
    new Promise((resolve) => {
      if (rlClosed) { resolve(null); return; }
      const onClose = () => resolve(null);
      rl.once('close', onClose);
      try {
        writePromptHeader(context.planMode);
        rl.question(promptLine(context.workingDir, context.intensity, context.yolo, context.planMode), (line) => {
          rl.removeListener('close', onClose);
          resolve(line);
        });
      } catch {
        rl.removeListener('close', onClose);
        resolve(null);
      }
    });

  while (true) {
    const line = await askLine();

    // EOF (Ctrl+D) or readline closed
    if (line === null) {
      process.stdout.write('\n');
      break;
    }

    const input = line.trim();
    if (!input) continue;
    if (EXIT_COMMANDS.has(input.toLowerCase())) break;

    // Handle /clear — reset conversation history
    if (input === '/clear' || input === 'clear') {
      context.messages = [];
      context.observations = [];
      context.iterationCount = 0;
      process.stdout.write(c(colors.gray, '  Conversation cleared.\n\n'));
      continue;
    }

    // Handle /yolo toggle
    if (input === '/yolo') {
      context.yolo = !context.yolo;
      const state = context.yolo ? 'ON' : 'OFF';
      process.stdout.write(c(colors.yellow, `  YOLO mode ${state}\n\n`));
      continue;
    }

    // Handle /plan toggle
    if (input === '/plan') {
      context.planMode = !context.planMode;
      const state = context.planMode ? 'ON' : 'OFF';
      process.stdout.write(c(colors.cyan, `  Plan mode ${state}\n\n`));
      continue;
    }

    // Handle /help
    if (input === '/help') {
      process.stdout.write(
        c(colors.bold, '\n  Available commands:\n\n') +
        c(colors.cyan, '  /help') + c(colors.gray, '          Show this help\n') +
        c(colors.cyan, '  /clear') + c(colors.gray, '         Clear conversation history\n') +
        c(colors.cyan, '  /plan') + c(colors.gray, '          Toggle plan mode (confirm before executing)\n') +
        c(colors.cyan, '  /yolo') + c(colors.gray, '          Toggle YOLO mode (skip confirmations)\n') +
        c(colors.cyan, '  /intensity [mode]') + c(colors.gray, '  Show or set intensity (low/medium/high/auto)\n') +
        c(colors.cyan, '  /model <name>') + c(colors.gray, '     Switch model\n') +
        c(colors.cyan, '  exit / quit') + c(colors.gray, '    Exit mercury\n') +
        c(colors.gray, '\n  Keyboard shortcuts:\n') +
        c(colors.cyan, '  Shift+Tab') + c(colors.gray, '      Toggle plan mode\n') +
        c(colors.cyan, '  Ctrl+C') + c(colors.gray, '         Cancel current operation\n') +
        c(colors.cyan, '  Ctrl+D') + c(colors.gray, '         Exit mercury\n\n')
      );
      continue;
    }

    // Handle /model <name>
    if (input.startsWith('/model ')) {
      context.model = input.slice(7).trim();
      process.stdout.write(c(colors.gray, `  Model set to: ${context.model}\n\n`));
      continue;
    }

    // Handle /intensity [low|medium|high|auto]
    if (input === '/intensity' || input.startsWith('/intensity ')) {
      const MODES: IntensityMode[] = ['low', 'medium', 'high', 'auto'];
      const arg = input.slice(10).trim() as IntensityMode;
      if (!arg) {
        // Show current + available modes with their configs
        const cfg = resolveIntensity(context.intensity);
        process.stdout.write(
          c(colors.bold, `\n  Intensity: ${context.intensity}\n`) +
          c(colors.gray, `  max_tokens=${cfg.maxTokens}  max_iterations=${cfg.maxIterations}  temperature=${cfg.temperature}\n\n`) +
          MODES.map((m) => {
            const mc = resolveIntensity(m);
            const active = m === context.intensity ? c(colors.cyan, ' ◀ current') : '';
            return (
              `  ${c(colors.cyan, m.padEnd(7))}` +
              c(colors.gray, `tokens=${mc.maxTokens}  iter=${mc.maxIterations}  temp=${mc.temperature}`) +
              active
            );
          }).join('\n') + '\n\n'
        );
      } else if (MODES.includes(arg)) {
        context.intensity = arg;
        const cfg = resolveIntensity(arg);
        process.stdout.write(
          c(colors.cyan, `  Intensity set to: ${arg}\n`) +
          c(colors.gray, `  max_tokens=${cfg.maxTokens}  max_iterations=${cfg.maxIterations}  temperature=${cfg.temperature}\n\n`)
        );
      } else {
        process.stdout.write(
          c(colors.yellow, `  Unknown intensity "${arg}". `) +
          c(colors.gray, `Valid values: ${MODES.join(', ')}\n\n`)
        );
      }
      continue;
    }

    process.stdout.write('\n');

    try {
      await loop.runTurn(context, input);
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err));
    }

    process.stdout.write('\n');
  }

  rl.close();
  process.stdout.write(c(colors.gray, 'Goodbye.\n'));
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

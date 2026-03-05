import type { Plan } from '../agent/types.js';
import type { AgentResult } from '../agent/types.js';

// ANSI color codes
export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

function c(color: keyof typeof colors, text: string): string {
  if (!process.stdout.isTTY) return text;
  return `${colors[color]}${text}${colors.reset}`;
}

/** Visible length of a string (strips ANSI escape codes). */
function vlen(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}

/** Pad a (possibly ANSI-coloured) string to `n` visible characters. */
function padVis(s: string, n: number): string {
  return s + ' '.repeat(Math.max(0, n - vlen(s)));
}

export function printBanner(
  version: string,
  model: string,
  intensity: string,
  workingDir: string,
  yolo: boolean,
): void {
  if (!process.stdout.isTTY) {
    process.stdout.write(`Mercury-2 Code CLI v${version}\n`);
    return;
  }

  const termWidth = process.stdout.columns ?? 80;
  const short = workingDir.replace(process.env['HOME'] ?? '', '~');

  const LEFT_W  = 34;
  const MIN_RIGHT = 30;
  const twoCol = termWidth >= LEFT_W + MIN_RIGHT + 5; // 5 = │ borders + separator
  const rightW = twoCol ? termWidth - LEFT_W - 5 : 0;

  // ── content rows ─────────────────────────────────────────────────────────
  const yoloBadge = yolo ? `  ${c('yellow', 'YOLO on')}` : '';
  const leftRows = [
    '',
    `  ${c('bold', c('cyan', '◆  Mercury-2'))} ${c('dim', 'Code CLI')}`,
    `  ${c('gray', `v${version} — Inception Labs`)}`,
    '',
    `  ${c('gray', 'model')}      ${model}`,
    `  ${c('gray', 'intensity')}  ${c('cyan', intensity)}${yoloBadge}`,
    `  ${c('gray', 'dir')}        ${c('dim', short)}`,
    '',
    `  ${c('yellow', '⚠')}  ${c('dim', 'Unofficial project author')}`,
    `     ${c('dim', 'diegorodriguez93@hotmail.com')}`,
    '',
  ];

  const rightRows = twoCol ? [
    '',
    `  ${c('bold', 'Quick start')}`,
    '',
    `  ${c('cyan', '/help')}       ${c('gray', 'All commands')}`,
    `  ${c('cyan', '/plan')}       ${c('gray', 'Toggle plan mode')}`,
    `  ${c('cyan', '/intensity')}  ${c('gray', 'Change intensity')}`,
    `  ${c('cyan', '/yolo')}       ${c('gray', 'Skip confirmations')}`,
    `  ${c('cyan', '/clear')}      ${c('gray', 'Reset conversation')}`,
    `  ${c('cyan', 'exit')}        ${c('gray', 'Quit')}`,
    '',
    `  ${c('dim', 'Type a task to get started')}`,
    '',
  ] : [];

  const rows = Math.max(leftRows.length, rightRows.length);

  // ── box drawing ───────────────────────────────────────────────────────────
  const totalInner = twoCol ? LEFT_W + 1 + rightW : LEFT_W + 2;
  const titleText  = `─── Mercury-2 CLI v${version} `;
  const topBar = c('gray',
    `╭${titleText}${'─'.repeat(Math.max(0, totalInner - titleText.length))}╮`
  );
  const botBar = c('gray', `╰${'─'.repeat(totalInner)}╯`);
  const sep    = c('gray', '│');

  process.stdout.write('\n');
  process.stdout.write(topBar + '\n');

  for (let i = 0; i < rows; i++) {
    const l = leftRows[i]  ?? '';
    const r = rightRows[i] ?? '';
    if (twoCol) {
      process.stdout.write(`${sep}${padVis(l, LEFT_W)}${sep}${padVis(r, rightW)}${sep}\n`);
    } else {
      process.stdout.write(`${sep}${padVis(l, totalInner - 2)}${sep}\n`);
    }
  }

  process.stdout.write(botBar + '\n\n');
}

export function printPlan(plan: Plan): void {
  process.stdout.write(`\n${c('bold', '📋 Plan: ')}${c('cyan', plan.goal)}\n`);
  process.stdout.write(`${c('gray', plan.rationale)}\n\n`);
  for (const step of plan.steps) {
    const optional = step.optional ? c('gray', ' (optional)') : '';
    process.stdout.write(`  ${c('yellow', `[${step.id}]`)} ${step.description}${optional}\n`);
  }
  process.stdout.write('\n');
}

export function printStepStart(stepId: string, description: string): void {
  process.stdout.write(`${c('blue', `▶ [${stepId}]`)} ${description}\n`);
}

export function printStepDone(stepId: string): void {
  process.stdout.write(`${c('green', `✓ [${stepId}]`)} done\n`);
}

export function printToolCall(name: string, args: Record<string, unknown>): void {
  const argsStr = Object.entries(args)
    .map(([k, v]) => `${k}=${JSON.stringify(v).slice(0, 60)}`)
    .join(', ');
  process.stdout.write(`  ${c('magenta', '⚙')} ${c('bold', name)}(${c('gray', argsStr)})\n`);
}

export function printResult(result: AgentResult): void {
  // Don't print anything for silent conversational turns
  if (result.status === 'success' && !result.summary) return;

  const icon = result.status === 'success' ? c('green', '✓') : c('red', '✗');
  const statusColor = result.status === 'success' ? 'green' : 'red';
  process.stdout.write(`\n${icon} ${c(statusColor, result.status.toUpperCase())}\n`);
  process.stdout.write(`${result.summary}\n`);
  process.stdout.write(
    c('gray', `\n${result.iterationsUsed} iteration(s), ${result.observations.length} tool call(s)\n`)
  );
}

export function printError(msg: string): void {
  process.stderr.write(`${c('red', '✗ Error:')} ${msg}\n`);
}

export function printWarning(msg: string): void {
  process.stderr.write(`${c('yellow', '⚠ Warning:')} ${msg}\n`);
}

export function printStreamChunk(chunk: string): void {
  process.stdout.write(chunk);
}

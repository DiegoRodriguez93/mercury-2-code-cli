import type { Tool, ToolCall } from '../tools/types.js';
import type { AgentContext } from '../agent/types.js';
import { promptSelect } from '../ui/select.js';

const R = '\x1b[0m'; // reset

const FG_REMOVED = '\x1b[31m'; // red
const FG_ADDED   = '\x1b[32m'; // green

const colors = {
  yellow:  '\x1b[33m',
  cyan:    '\x1b[36m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  reset:   R,
  gray:    '\x1b[90m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  magenta: '\x1b[35m',
  blue:    '\x1b[34m',
  white:   '\x1b[37m',
};

function c(col: keyof typeof colors, text: string): string {
  if (!process.stdout.isTTY) return text;
  return `${colors[col]}${text}${R}`;
}

export type ConfirmResult = 'yes' | 'no' | 'always';

// ── Syntax highlighting ─────────────────────────────────────────────────────

function extOf(filePath: string): string {
  const m = filePath.match(/\.([^./\\]+)$/);
  return m ? m[1].toLowerCase() : '';
}

/** Apply per-language ANSI colour to a single source line. */
function highlightLine(line: string, ext: string): string {
  if (!process.stdout.isTTY) return line;

  switch (ext) {
    case 'js': case 'ts': case 'jsx': case 'tsx': case 'mjs': case 'cjs':
      return hlJS(line);
    case 'json':
      return hlJSON(line);
    case 'md': case 'markdown':
      return hlMD(line);
    case 'sh': case 'bash': case 'zsh': case 'fish':
      return hlSH(line);
    case 'css': case 'scss': case 'less':
      return hlCSS(line);
    case 'html': case 'htm': case 'xml': case 'svg':
      return hlHTML(line);
    default:
      return line;
  }
}

/** Escape already-set ANSI sequences when we're about to wrap with another color. */
function esc(s: string) { return s; }

function hlJS(line: string): string {
  // Simple regex-based pass — comments first, then strings, then keywords, then numbers
  return line
    // single-line comment
    .replace(/(\/\/.*)$/, `${colors.gray}$1${R}`)
    // strings (simple – doesn't handle nested quotes)
    .replace(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, `${colors.green}$&${R}`)
    // keywords
    .replace(
      /\b(async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|from|function|if|import|in|instanceof|let|new|of|return|static|super|switch|this|throw|try|typeof|var|void|while|yield)\b/g,
      `${colors.blue}$1${R}`,
    )
    // numbers
    .replace(/\b(\d+(?:\.\d+)?)\b/g, `${colors.yellow}$1${R}`);
}

function hlJSON(line: string): string {
  return line
    // key
    .replace(/^(\s*)(["'])([^"']+)\2(\s*:)/g, `$1${colors.cyan}$2$3$2${R}$4`)
    // string value
    .replace(/:\s*(["'])([^"']*)\1/g, (m) =>
      m.replace(/(["'])([^"']*)\1$/, `${colors.green}$1$2$1${R}`),
    )
    // boolean/null
    .replace(/\b(true|false|null)\b/g, `${colors.magenta}$1${R}`)
    // numbers
    .replace(/:\s*(-?\d+(?:\.\d+)?)/g, (m) =>
      m.replace(/(-?\d+(?:\.\d+)?)$/, `${colors.yellow}$1${R}`),
    );
}

function hlMD(line: string): string {
  // headings
  if (/^#{1,6}\s/.test(line)) return `${colors.cyan}${colors.bold}${line}${R}`;
  // horizontal rule
  if (/^[-*_]{3,}$/.test(line.trim())) return `${colors.gray}${line}${R}`;
  // fenced code block delimiter
  if (/^```/.test(line)) return `${colors.gray}${line}${R}`;
  // blockquote
  if (/^>/.test(line)) return `${colors.gray}${line}${R}`;
  // list item
  if (/^(\s*[-*+]|\s*\d+\.) /.test(line))
    return line.replace(/^(\s*[-*+]|\s*\d+\.)/, `${colors.yellow}$1${R}`);
  // inline code
  return line.replace(/`([^`]+)`/g, `${colors.gray}\`$1\`${R}`)
    // bold
    .replace(/\*\*([^*]+)\*\*/g, `${colors.bold}$1${R}`)
    // italic
    .replace(/\*([^*]+)\*/g, `${colors.dim}$1${R}`);
}

function hlSH(line: string): string {
  // comment
  if (/^\s*#/.test(line)) return `${colors.gray}${line}${R}`;
  return line
    .replace(/(["'])(?:(?!\1)[^\\]|\\.)*\1/g, `${colors.green}$&${R}`)
    .replace(/\b(if|then|else|elif|fi|for|while|do|done|case|esac|in|function|return|export|local|echo|exit|source|\.|eval|exec)\b/g,
      `${colors.blue}$1${R}`)
    .replace(/(-{1,2}[a-zA-Z][\w-]*)/g, `${colors.yellow}$1${R}`);
}

function hlCSS(line: string): string {
  return line
    // property name
    .replace(/^\s*([\w-]+)\s*:/, `  ${colors.cyan}$1${R}:`)
    // selector
    .replace(/^([.#:[\w*>+~, ]+)\s*\{/, `${colors.yellow}$1${R}{`)
    // string/value
    .replace(/(["'])([^"']*)\1/g, `${colors.green}$1$2$1${R}`);
}

function hlHTML(line: string): string {
  return line
    // comments
    .replace(/(<!--.*?-->)/g, `${colors.gray}$1${R}`)
    // attributes
    .replace(/(\s[\w-]+=)(["'])/g, `${colors.cyan}$1${R}${colors.green}$2`)
    // tags
    .replace(/(<\/?[\w-]+)/g, `${colors.blue}$1${R}`);
}

// ── Preview renderers ───────────────────────────────────────────────────────

const MAX_CONTENT_LINES = 60;
const CONTEXT_LINES = 3; // unchanged lines to show around each hunk

/**
 * Dim a syntax-highlighted line for context (unchanged) rows.
 * Re-injects dim after each reset so the whole line stays faded.
 */
function applyDim(content: string): string {
  if (!process.stdout.isTTY) return content;
  const dim = '\x1b[2m';
  return dim + content.replace(/\x1b\[0m/g, `${R}${dim}`) + R;
}

function ruler(width = 60): string {
  return c('gray', '─'.repeat(Math.min(width, process.stdout.columns ?? 80)));
}

// ── LCS-based line diff ──────────────────────────────────────────────────────

type DiffLine = { type: 'same' | 'remove' | 'add'; line: string };

function lineDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const m = oldLines.length;
  const n = newLines.length;

  // DP LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack
  const result: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: 'same', line: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'add', line: newLines[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'remove', line: oldLines[i - 1] });
      i--;
    }
  }
  return result;
}

/**
 * Collapse long runs of unchanged lines into a `@@ -x +y @@` hunk header,
 * keeping CONTEXT_LINES of context before and after each changed region.
 */
function applyContext(diff: DiffLine[]): Array<DiffLine | { type: 'hunk'; skipped: number }> {
  // Mark which indices are "near a change"
  const changed = diff.map((d) => d.type !== 'same');
  const keep = new Array(diff.length).fill(false);
  for (let idx = 0; idx < diff.length; idx++) {
    if (!changed[idx]) continue;
    for (let k = Math.max(0, idx - CONTEXT_LINES); k <= Math.min(diff.length - 1, idx + CONTEXT_LINES); k++) {
      keep[k] = true;
    }
  }

  const result: Array<DiffLine | { type: 'hunk'; skipped: number }> = [];
  let skipping = 0;
  for (let idx = 0; idx < diff.length; idx++) {
    if (keep[idx]) {
      if (skipping > 0) {
        result.push({ type: 'hunk', skipped: skipping });
        skipping = 0;
      }
      result.push(diff[idx]);
    } else {
      skipping++;
    }
  }
  if (skipping > 0) result.push({ type: 'hunk', skipped: skipping });
  return result;
}

function renderDiff(call: ToolCall): string {
  const args = call.args as Record<string, string>;
  const filePath = String(args['path'] ?? '');
  const oldStr = String(args['old_string'] ?? '');
  const newStr = String(args['new_string'] ?? '');
  const ext = extOf(filePath);

  const output: string[] = [];
  output.push(`  ${c('bold', filePath)}`);
  output.push(`  ${ruler()}`);

  const diff = lineDiff(oldStr.split('\n'), newStr.split('\n'));
  const withCtx = applyContext(diff);

  for (const entry of withCtx) {
    if (entry.type === 'hunk') {
      output.push(c('gray', `  @@ ${entry.skipped} unchanged line${entry.skipped === 1 ? '' : 's'} @@`));
    } else if (entry.type === 'remove') {
      output.push(`  ${FG_REMOVED}- ${R}${highlightLine(entry.line, ext)}`);
    } else if (entry.type === 'add') {
      output.push(`  ${FG_ADDED}+ ${R}${highlightLine(entry.line, ext)}`);
    } else {
      // Context: syntax-highlighted but dimmed
      output.push(`  ${applyDim(`  ${highlightLine(entry.line, ext)}`)}`);
    }
  }

  return output.join('\n') + '\n';
}

function renderFileContent(call: ToolCall): string {
  const args = call.args as Record<string, string>;
  const filePath = String(args['path'] ?? '');
  const content  = String(args['content'] ?? '');
  const ext = extOf(filePath);

  const lines: string[] = [];
  lines.push(`  ${c('bold', filePath)}`);
  lines.push(`  ${ruler()}`);

  const contentLines = content.split('\n');
  const cap = Math.min(contentLines.length, MAX_CONTENT_LINES);
  for (let i = 0; i < cap; i++) {
    lines.push(`  ${highlightLine(contentLines[i], ext)}`);
  }
  if (contentLines.length > MAX_CONTENT_LINES) {
    const hidden = contentLines.length - MAX_CONTENT_LINES;
    lines.push(c('gray', `  … (${hidden} more line${hidden === 1 ? '' : 's'})`));
  }

  return lines.join('\n') + '\n';
}

function renderShell(call: ToolCall): string {
  const args = call.args as Record<string, string>;
  const cmd = String(args['command'] ?? '');
  const lines: string[] = [];
  lines.push(`  ${ruler()}`);
  for (const l of cmd.split('\n').slice(0, MAX_CONTENT_LINES)) {
    lines.push(`  ${c('gray', '$')} ${hlSH(l)}`);
  }
  lines.push(`  ${ruler()}`);
  return lines.join('\n') + '\n';
}

function renderGeneric(call: ToolCall): string {
  const lines: string[] = [];
  let shown = 0;
  for (const [k, v] of Object.entries(call.args)) {
    if (shown >= MAX_CONTENT_LINES) break;
    const val = typeof v === 'string' ? v : JSON.stringify(v);
    lines.push(`  ${c('cyan', k)}: ${c('gray', val.slice(0, 120))}`);
    shown++;
  }
  return lines.join('\n') + '\n';
}

function renderPreview(call: ToolCall): string {
  switch (call.name) {
    case 'edit_file':   return renderDiff(call);
    case 'write_file':  return renderFileContent(call);
    case 'shell':       return renderShell(call);
    default:            return renderGeneric(call);
  }
}

// ── Main export ─────────────────────────────────────────────────────────────

export async function confirmAction(
  tool: Tool,
  call: ToolCall,
  ctx: AgentContext
): Promise<ConfirmResult> {
  const dangerBadge =
    tool.dangerLevel === 'high'
      ? c('red', ' [DANGER]')
      : tool.dangerLevel === 'moderate'
      ? c('yellow', ' [moderate]')
      : '';

  process.stdout.write('\n');
  process.stdout.write(
    `${c('yellow', '⚠ Confirm action:')} ${c('bold', call.name)}${dangerBadge}\n`,
  );
  process.stdout.write(renderPreview(call));

  const result = await promptSelect('', ['Yes', 'No'], 0, 'Always (skip all confirmations)');

  if (result.type === 'cancelled' || (result.type === 'selected' && result.index === 1)) {
    return 'no';
  }
  if (result.type === 'custom') {
    ctx.yolo = true;
    return 'always';
  }
  return 'yes';
}

/**
 * Markdown → ANSI terminal renderer with Tokyo Night syntax highlighting.
 * Zero runtime dependencies.
 */

// ── ANSI helpers ─────────────────────────────────────────────────────────────

const isTTY   = process.stdout.isTTY ?? false;
const trueColor = isTTY && (
  process.env['COLORTERM'] === 'truecolor' ||
  process.env['COLORTERM'] === '24bit' ||
  // Windows Terminal, VSCode, most modern terminals default to true color
  !!process.env['WT_SESSION'] ||
  !!process.env['TERM_PROGRAM']
);

const R = '\x1b[0m';

function fg(r: number, g: number, b: number): string {
  if (!isTTY) return '';
  if (trueColor) return `\x1b[38;2;${r};${g};${b}m`;
  // 256-color fallback: pick nearest from 6x6x6 cube
  const c = (v: number) => Math.round(v / 255 * 5);
  return `\x1b[38;5;${16 + 36 * c(r) + 6 * c(g) + c(b)}m`;
}

const A = {
  reset:     R,
  bold:      '\x1b[1m',
  dim:       '\x1b[2m',
  italic:    '\x1b[3m',
  underline: '\x1b[4m',
  // Basic fallbacks
  cyan:      '\x1b[36m',
  yellow:    '\x1b[33m',
  green:     '\x1b[32m',
  blue:      '\x1b[34m',
  magenta:   '\x1b[35m',
  gray:      '\x1b[90m',
  bgGray:    '\x1b[100m',
  white:     '\x1b[97m',
};

function a(code: string, text: string): string {
  return isTTY ? `${code}${text}${R}` : text;
}

// ── Tokyo Night palette ───────────────────────────────────────────────────────
// https://github.com/enkia/tokyo-night-vscode-theme

const TN = {
  comment:   () => fg(86,  95,  137) + A.italic,
  keyword:   () => fg(187, 154, 247),
  string:    () => fg(158, 206, 106),
  number:    () => fg(255, 158, 100),
  func:      () => fg(122, 162, 247),
  type:      () => fg(224, 175, 104),
  operator:  () => fg(137, 221, 255),
  builtin:   () => fg(42,  195, 222),
  decorator: () => fg(187, 154, 247) + A.italic,
  tag:       () => fg(247, 118, 142),
  attr:      () => fg(115, 218, 202),
  text:      () => fg(192, 202, 245),
  punct:     () => fg(137, 221, 255),
};

function tok(colorFn: () => string, text: string): string {
  if (!isTTY) return text;
  return `${colorFn()}${text}${R}`;
}

// ── Syntax highlighting ───────────────────────────────────────────────────────

const JS_KEYWORDS = new Set([
  'break','case','catch','class','const','continue','debugger','default',
  'delete','do','else','export','extends','finally','for','function','if',
  'import','in','instanceof','let','new','of','return','static','super',
  'switch','this','throw','try','typeof','var','void','while','with','yield',
  'async','await','from','as','type','interface','enum','implements',
  'namespace','declare','abstract','override','readonly','keyof','infer',
  'satisfies','using',
]);

const JS_BUILTINS = new Set([
  'console','process','require','module','exports','__dirname','__filename',
  'Promise','Array','Object','String','Number','Boolean','Symbol','BigInt',
  'Map','Set','WeakMap','WeakSet','Error','TypeError','RangeError',
  'JSON','Math','Date','RegExp','undefined','null','true','false','NaN',
  'Infinity','parseInt','parseFloat','isNaN','isFinite','setTimeout',
  'clearTimeout','setInterval','clearInterval','fetch','Buffer','global',
  'window','document','navigator','location','history',
]);

const PY_KEYWORDS = new Set([
  'and','as','assert','async','await','break','class','continue','def',
  'del','elif','else','except','False','finally','for','from','global',
  'if','import','in','is','lambda','None','nonlocal','not','or','pass',
  'raise','return','True','try','while','with','yield',
]);

const PY_BUILTINS = new Set([
  'print','len','range','enumerate','zip','map','filter','sorted','reversed',
  'list','dict','set','tuple','str','int','float','bool','bytes','bytearray',
  'type','isinstance','issubclass','hasattr','getattr','setattr','delattr',
  'super','property','classmethod','staticmethod','abs','round','min','max',
  'sum','open','input','repr','hash','id','dir','vars','callable',
  'iter','next','any','all','hex','oct','bin','chr','ord',
]);

const BASH_KEYWORDS = new Set([
  'if','then','else','elif','fi','for','while','do','done','case','esac',
  'in','function','return','local','export','readonly','declare','typeset',
  'break','continue','exit','shift','set','unset','source','alias',
  'echo','printf','read','test','true','false',
]);

interface Pattern {
  re: RegExp;   // sticky flag required
  color: (m: string) => string;
}

function makePatterns(lang: string): Pattern[] {
  const l = lang.toLowerCase();

  // ── Language-agnostic helpers ──────────────────────────────────────────────

  const tripleQuote: Pattern = {
    re: /"""[\s\S]*?"""|'''[\s\S]*?'''/y,
    color: (m) => tok(TN.string, m),
  };
  const doubleStr: Pattern = {
    re: /"(?:[^"\\]|\\.)*"/y,
    color: (m) => tok(TN.string, m),
  };
  const singleStr: Pattern = {
    re: /'(?:[^'\\]|\\.)*'/y,
    color: (m) => tok(TN.string, m),
  };
  const backtickStr: Pattern = {
    re: /`(?:[^`\\]|\\.)*`/y,
    color: (m) => tok(TN.string, m),
  };
  const lineComment = (prefix: string): Pattern => ({
    re: new RegExp(String.raw`${prefix}.*`, 'y'),
    color: (m) => tok(TN.comment, m),
  });
  const blockComment: Pattern = {
    re: /\/\*[\s\S]*?\*\//y,
    color: (m) => tok(TN.comment, m),
  };
  const hexNum: Pattern = {
    re: /0[xX][0-9a-fA-F]+/y,
    color: (m) => tok(TN.number, m),
  };
  const num: Pattern = {
    re: /\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y,
    color: (m) => tok(TN.number, m),
  };
  const operators: Pattern = {
    re: /[+\-*/%=<>!&|^~?:]+|[[\]{}(),;.]/y,
    color: (m) => tok(TN.punct, m),
  };

  // ── Python ─────────────────────────────────────────────────────────────────
  if (l === 'python' || l === 'py') {
    return [
      { re: /#.*/y,            color: (m) => tok(TN.comment, m) },
      tripleQuote,
      doubleStr,
      singleStr,
      { re: /@\w+/y,           color: (m) => tok(TN.decorator, m) },
      hexNum, num,
      {
        re: /\b([A-Z]\w*)\b/y,
        color: (m) => tok(TN.type, m),
      },
      {
        re: /\b(\w+)(?=\s*\()/y,
        color: (m, ) => {
          if (PY_KEYWORDS.has(m)) return tok(TN.keyword, m);
          if (PY_BUILTINS.has(m)) return tok(TN.builtin, m);
          return tok(TN.func, m);
        },
      },
      {
        re: /\b\w+\b/y,
        color: (m) => {
          if (PY_KEYWORDS.has(m)) return tok(TN.keyword, m);
          if (PY_BUILTINS.has(m)) return tok(TN.builtin, m);
          return tok(TN.text, m);
        },
      },
      operators,
    ];
  }

  // ── Bash / Shell ────────────────────────────────────────────────────────────
  if (l === 'bash' || l === 'sh' || l === 'shell' || l === 'zsh') {
    return [
      lineComment('#'),
      doubleStr, singleStr,
      { re: /\$\{?[\w@#*?!$-]+\}?/y, color: (m) => tok(TN.builtin, m) },
      hexNum, num,
      {
        re: /\b\w+\b/y,
        color: (m) => {
          if (BASH_KEYWORDS.has(m)) return tok(TN.keyword, m);
          return tok(TN.text, m);
        },
      },
      operators,
    ];
  }

  // ── JSON ────────────────────────────────────────────────────────────────────
  if (l === 'json' || l === 'jsonc') {
    return [
      lineComment('//'),
      doubleStr,
      hexNum, num,
      { re: /\b(?:true|false|null)\b/y, color: (m) => tok(TN.keyword, m) },
      operators,
    ];
  }

  // ── CSS / SCSS ──────────────────────────────────────────────────────────────
  if (l === 'css' || l === 'scss' || l === 'less') {
    return [
      blockComment, lineComment('//'),
      { re: /#[0-9a-fA-F]{3,8}\b/y,   color: (m) => tok(TN.number, m) },
      doubleStr, singleStr,
      { re: /[@.#][\w-]+/y,            color: (m) => tok(TN.decorator, m) },
      { re: /[\w-]+(?=\s*:)/y,         color: (m) => tok(TN.attr, m) },
      hexNum, num,
      operators,
    ];
  }

  // ── HTML / JSX tags (simple) ────────────────────────────────────────────────
  if (l === 'html' || l === 'xml' || l === 'jsx' || l === 'tsx') {
    return [
      { re: /<!--[\s\S]*?-->/y,         color: (m) => tok(TN.comment, m) },
      { re: /<\/?\s*[\w.:-]+/y,         color: (m) => tok(TN.tag, m) },
      { re: /[\w:-]+(?=\s*=)/y,         color: (m) => tok(TN.attr, m) },
      doubleStr, singleStr, backtickStr,
      blockComment, lineComment('//'),
      hexNum, num,
      { re: /\b\w+\b/y,
        color: (m) => JS_KEYWORDS.has(m) ? tok(TN.keyword, m) : tok(TN.text, m) },
      operators,
    ];
  }

  // ── TypeScript / JavaScript (default for code) ──────────────────────────────
  return [
    blockComment,
    lineComment('//'),
    backtickStr,
    doubleStr,
    singleStr,
    { re: /@\w+/y,                    color: (m) => tok(TN.decorator, m) },
    hexNum, num,
    // Type annotations: word followed by < or used after : in TS
    {
      re: /\b([A-Z][A-Za-z0-9_]*)\b/y,
      color: (m) => tok(TN.type, m),
    },
    // Function calls
    {
      re: /\b(\w+)(?=\s*[<(])/y,
      color: (m) => {
        if (JS_KEYWORDS.has(m))  return tok(TN.keyword, m);
        if (JS_BUILTINS.has(m)) return tok(TN.builtin, m);
        return tok(TN.func, m);
      },
    },
    // Other words
    {
      re: /\b\w+\b/y,
      color: (m) => {
        if (JS_KEYWORDS.has(m))  return tok(TN.keyword, m);
        if (JS_BUILTINS.has(m)) return tok(TN.builtin, m);
        return tok(TN.text, m);
      },
    },
    operators,
  ];
}

function highlightCode(code: string, lang: string): string {
  if (!isTTY || !lang) return code;

  const patterns = makePatterns(lang);
  let result = '';
  let i = 0;

  outer: while (i < code.length) {
    for (const { re, color } of patterns) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (m !== null) {
        result += color(m[0]);
        i += m[0].length;
        continue outer;
      }
    }
    result += code[i++];
  }
  return result;
}

// ── Inline rendering ──────────────────────────────────────────────────────────

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_, a, b) =>
      isTTY ? `${A.bold}${a ?? b}${R}` : (a ?? b))
    .replace(/(?<!\w)\*([^*\n]+)\*(?!\w)|(?<!\w)_([^_\n]+)_(?!\w)/g, (_, a, b) =>
      isTTY ? `${A.italic}${a ?? b}${R}` : (a ?? b))
    .replace(/`([^`]+)`/g, (_, code) =>
      isTTY
        ? `${A.bgGray}${A.white} ${code} ${R}`
        : `\`${code}\``)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, (_, label) =>
      isTTY ? `${A.underline}${fg(122, 162, 247)}${label}${R}` : label)
    .replace(/https?:\/\/\S+/g, (url) =>
      isTTY ? `${A.underline}${fg(122, 162, 247)}${url}${R}` : url);
}

// ── Block renderers ───────────────────────────────────────────────────────────

const HEADER_COLORS: Record<number, string> = {
  1: `${A.bold}${fg(187, 154, 247)}`,  // purple
  2: `${A.bold}${fg(122, 162, 247)}`,  // blue
  3: `${A.bold}${fg(158, 206, 106)}`,  // green
  4: `${A.bold}${fg(224, 175, 104)}`,  // yellow
  5: `${A.bold}${fg(137, 221, 255)}`,  // cyan
  6: `${A.bold}${A.gray}`,
};

function renderHeader(line: string): string | null {
  const m = line.match(/^(#{1,6})\s+(.*)/);
  if (!m) return null;
  const level = m[1]!.length;
  const text  = renderInline(m[2]!);
  const color = HEADER_COLORS[level] ?? A.bold;
  const rule  = level <= 2
    ? '\n' + a(A.dim, '─'.repeat(56))
    : '';
  const prefix = level <= 2 ? '\n' : '';
  return `${prefix}${a(color, text)}${rule}`;
}

function renderCodeBlock(codeLines: string[], lang: string): string {
  const langLabel = lang
    ? a(`${A.dim}${fg(86, 95, 137)}`, lang) + '\n'
    : '';
  const body = codeLines
    .map((l) => {
      const highlighted = lang ? highlightCode(l, lang) : a(TN.text(), l);
      return highlighted;
    })
    .join('\n');
  return `${langLabel}${body}`;
}

function isSeparatorRow(line: string): boolean {
  return /^\|[\s|:-]+\|$/.test(line);
}

function parseTableRow(line: string): string[] {
  return line.split('|').slice(1, -1).map((c) => renderInline(c.trim()));
}

function renderTable(allLines: string[]): string {
  const rows = allLines
    .filter((l) => !isSeparatorRow(l))
    .map(parseTableRow);

  if (rows.length === 0) return '';

  const strip    = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');
  const colCount = Math.max(...rows.map((r) => r.length));
  const widths   = Array.from({ length: colCount }, (_, ci) =>
    Math.max(...rows.map((r) => strip(r[ci] ?? '').length), 3)
  );

  const pad = (s: string, w: number) =>
    s + ' '.repeat(Math.max(0, w - strip(s).length));

  const hDiv = a(A.dim, '┼' + widths.map((w) => '─'.repeat(w + 2)).join('┼') + '┼');
  const topB = a(A.dim, '┌' + widths.map((w) => '─'.repeat(w + 2)).join('┬') + '┐');
  const botB = a(A.dim, '└' + widths.map((w) => '─'.repeat(w + 2)).join('┴') + '┘');

  const formatRow = (row: string[], isHeader: boolean) => {
    const cells = widths.map((w, ci) => {
      const cell = pad(row[ci] ?? '', w);
      return isHeader ? a(A.bold, cell) : cell;
    });
    return (
      a(A.dim, '│') +
      cells.map((c) => ` ${c} ${a(A.dim, '│')}`).join('')
    );
  };

  const lines = [topB];
  rows.forEach((row, i) => {
    lines.push(formatRow(row, i === 0));
    if (i === 0 && rows.length > 1) lines.push(hDiv);
  });
  lines.push(botB);
  return lines.join('\n');
}

// ── Main render ───────────────────────────────────────────────────────────────

const MARGIN = '  ';  // left padding for all output

export function renderMarkdown(input: string): string {
  const lines  = input.split('\n');
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Fenced code block
    const fenceMatch = line.match(/^```(\w*)/);
    if (fenceMatch) {
      const lang      = fenceMatch[1] ?? '';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith('```')) {
        codeLines.push(lines[i]!);
        i++;
      }
      output.push(renderCodeBlock(codeLines, lang));
      i++;
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line)) {
      output.push(a(A.dim, '─'.repeat(56)));
      i++;
      continue;
    }

    // Header
    const header = renderHeader(line);
    if (header !== null) {
      output.push(header);
      i++;
      continue;
    }

    // Table — collect all consecutive table lines
    if (line.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i]!.startsWith('|')) {
        tableLines.push(lines[i]!);
        i++;
      }
      output.push(renderTable(tableLines));
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      output.push(
        a(`${fg(86, 95, 137)}${A.bold}`, '▌') + ' ' +
        a(A.italic, renderInline(line.slice(2)))
      );
      i++;
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)/);
    if (ulMatch) {
      const depth  = Math.floor(ulMatch[1]!.length / 2);
      const bullet = depth > 0
        ? a(A.dim, '  ◦ ')
        : a(fg(122, 162, 247), '• ');
      const indent = '  '.repeat(depth);
      output.push(indent + bullet + renderInline(ulMatch[2]!));
      i++;
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
    if (olMatch) {
      output.push(
        a(fg(255, 158, 100), `${olMatch[2]}.`) +
        ' ' + renderInline(olMatch[3]!)
      );
      i++;
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      output.push('');
      i++;
      continue;
    }

    // Plain paragraph
    output.push(renderInline(line));
    i++;
  }

  // Apply left margin to every line
  const rendered = output.join('\n');
  if (!isTTY) return rendered;
  return rendered
    .split('\n')
    .map((l) => MARGIN + l)
    .join('\n');
}

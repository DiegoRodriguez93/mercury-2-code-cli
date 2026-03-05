import type { IntensityMode } from '../intensity/types.js';

export interface CLIOptions {
  prompt?: string;
  intensity: IntensityMode;
  yolo: boolean;
  plan: boolean;
  cwd: string;
  maxIter?: number;
  model?: string;
  debug: boolean;
  version: boolean;
  help: boolean;
}

const VALID_INTENSITY: IntensityMode[] = ['low', 'medium', 'high', 'auto'];

export function parseArgs(argv: string[]): CLIOptions {
  const args = argv.slice(2);
  const opts: CLIOptions = {
    intensity: 'auto',
    yolo: false,
    plan: false,
    cwd: process.cwd(),
    debug: false,
    version: false,
    help: false,
    model: undefined,
  };

  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === '--version' || arg === '-v') {
      opts.version = true;
    } else if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--yolo') {
      opts.yolo = true;
    } else if (arg === '--plan') {
      opts.plan = true;
    } else if (arg === '--debug') {
      opts.debug = true;
    } else if (arg === '-p' || arg === '--prompt') {
      opts.prompt = args[++i];
    } else if (arg.startsWith('--prompt=')) {
      opts.prompt = arg.slice('--prompt='.length);
    } else if (arg === '-i' || arg === '--intensity') {
      const val = args[++i] as IntensityMode;
      if (VALID_INTENSITY.includes(val)) opts.intensity = val;
    } else if (arg.startsWith('--intensity=')) {
      const val = arg.slice('--intensity='.length) as IntensityMode;
      if (VALID_INTENSITY.includes(val)) opts.intensity = val;
    } else if (arg === '--model') {
      opts.model = args[++i];
    } else if (arg.startsWith('--model=')) {
      opts.model = arg.slice('--model='.length);
    } else if (arg === '--cwd') {
      opts.cwd = args[++i] ?? process.cwd();
    } else if (arg.startsWith('--cwd=')) {
      opts.cwd = arg.slice('--cwd='.length);
    } else if (arg === '--max-iter') {
      const n = parseInt(args[++i] ?? '', 10);
      if (!isNaN(n)) opts.maxIter = n;
    } else if (arg.startsWith('--max-iter=')) {
      const n = parseInt(arg.slice('--max-iter='.length), 10);
      if (!isNaN(n)) opts.maxIter = n;
    } else if (!arg.startsWith('-')) {
      positionals.push(arg);
    }
  }

  // Positional args form the prompt if not set via -p/--prompt
  if (!opts.prompt && positionals.length > 0) {
    opts.prompt = positionals.join(' ');
  }

  return opts;
}

export function printHelp(version: string): void {
  process.stdout.write(`
mercury-2-code-cli v${version}
Autonomous AI coding agent powered by Mercury-2 (Inception Labs)

Usage:
  mercury [prompt] [options]
  mercury -p "refactor auth module" --intensity=high

Options:
  -p, --prompt <text>      Task to perform (or pass as positional arg)
  -i, --intensity <level>  low | medium | high | auto  (default: auto)
      --yolo               Skip all confirmation prompts
      --plan               Start with plan mode on (confirm plan before executing)
      --cwd <path>         Working directory (default: current dir)
      --max-iter <n>       Max agent iterations (default: 10)
      --model <name>       Model to use (default: mercury-2)
      --debug              Enable debug logging (or set DEBUG=mercury)
  -v, --version            Show version
  -h, --help               Show this help

Authentication:
  Set INCEPTION_API_KEY environment variable, or run mercury once to be
  prompted. The key is saved to ~/.mercury2/config.json (chmod 600).

Examples:
  mercury "add unit tests for utils.ts"
  mercury --intensity=low "list files in src/"
  mercury --yolo --intensity=high "refactor the entire auth module"
  INCEPTION_API_KEY=sk-... mercury "fix the failing tests"
`);
}

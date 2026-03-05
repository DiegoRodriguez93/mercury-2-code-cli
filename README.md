# mercury-2-code-cli

<img width="2222" height="976" alt="Screenshot 2026-03-05 113344" src="https://github.com/user-attachments/assets/199d44e7-af10-4eed-beff-bbf0835678c6" />

[![npm version](https://img.shields.io/npm/v/mercury-2-code-cli)](https://www.npmjs.com/package/mercury-2-code-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

**Autonomous AI coding agent CLI powered by Mercury-2 — the fastest diffusion language model for software development by Inception Labs.**

> **Unofficial community project.** This is not an official Inception Labs product and is not supported by the Inception team. Use at your own risk.

```bash
npm i -g mercury-2-code-cli
mercury "add auth middleware to my Express app"
```

---

## Quick Install

```bash
npm install -g mercury-2-code-cli
```

Set your API key (get one at [inceptionlabs.ai](https://www.inceptionlabs.ai/)):

```bash
export INCEPTION_API_KEY=your_key_here
```

Or just run `mercury` with no arguments — you will be prompted and the key is saved to `~/.mercury2/config.json` (chmod 600).

---

## Requirements

- **Node.js >= 18**
- **Platform:** macOS · Linux · Windows (native Node.js + Windows Terminal) · WSL

---

## Quick Start

```bash
# Set API key
export INCEPTION_API_KEY=sk-...

# Run a task
mercury "add unit tests for src/utils.ts"

# High intensity — thorough, writes tests, verifies changes
mercury --intensity=high "refactor the auth module to use JWT"

# Skip confirmation prompts (YOLO mode)
mercury --yolo "fix all TypeScript errors"

# Start with plan mode on — review the plan before execution begins
mercury --plan "migrate the database schema"

# Specify working directory
mercury --cwd /path/to/project "add a Dockerfile"
```

---

## Interactive REPL

Run `mercury` with no arguments to enter the interactive REPL. A persistent session accumulates conversation context across turns.

```
mercury ~/my-project [auto] ❯
```

### Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands and keyboard shortcuts |
| `/plan` | Toggle plan mode on/off |
| `/intensity [mode]` | Show current intensity or set to `low`/`medium`/`high`/`auto` |
| `/yolo` | Toggle YOLO mode (skip all confirmations) |
| `/model <name>` | Switch model for the current session |
| `/clear` | Clear conversation history |
| `exit` / `quit` | Exit mercury |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Shift+Tab` | Toggle plan mode on/off |
| `Ctrl+C` | Cancel the current operation |
| `Ctrl+D` | Exit mercury |

---

## Plan Mode

Plan mode adds a review step before execution. The agent generates a structured plan (goal + ordered steps) and presents it for your approval before running any tools.

Enable plan mode:
- Pass `--plan` on the CLI: `mercury --plan "refactor auth"`
- Type `/plan` in the REPL to toggle
- Press `Shift+Tab` in the REPL to toggle

When plan mode is active, the prompt shows a `[plan]` badge and you can inspect the proposed steps before the executor runs.

---

## Features

### Tools

| Tool | Description | Confirmation Required |
|------|-------------|----------------------|
| `read_file` | Read file contents | No |
| `write_file` | Write/create files | Yes |
| `edit_file` | Replace exact string block in file | Yes |
| `shell` | Execute shell commands | Yes |
| `grep` | Search file contents by pattern | No |
| `glob` | Find files by glob pattern | No |
| `git` | Git status/diff/log/add/commit | Write ops: Yes |
| `npm` | npm/node script runner | Yes |

### Intensity Modes

Control how deep the agent goes:

| Mode | Max Tokens | Max Iterations | Best For |
|------|-----------|----------------|---------|
| `low` | 2,048 | 3 | Quick lookups, simple single-file edits |
| `medium` | 8,192 | 7 | Everyday coding tasks |
| `high` | 16,384 | 15 | Complex refactors, full feature implementation |
| `auto` (default) | 8,192 | 10 | Adaptive — agent decides based on task complexity |

Set via `--intensity=<mode>` on the CLI or `/intensity <mode>` in the REPL.

### Human-in-the-Loop (HITL)

Before any write or shell operation, mercury shows a preview and prompts for confirmation using an interactive arrow-key selector:

```
⚠ Confirm action: write_file [moderate]
  src/auth.ts
  ──────────────────────────────────────────────────────────
  + import jwt from 'jsonwebtoken';
  + ...

> Yes
  No
  Always (skip all confirmations)
```

Use the arrow keys to select:
- **Yes** — approve this action
- **No** — skip this action
- **Always** — approve all remaining actions for this session (equivalent to `--yolo`)

For `edit_file`, a syntax-highlighted diff shows exactly what will change before you confirm.

### YOLO Mode

Skip all confirmation prompts:

```bash
# CLI flag
mercury --yolo "fix all TypeScript errors"

# Toggle in REPL
/yolo
```

Use with care — the agent will write files and run shell commands without asking.

---

## CLI Reference

```
mercury [prompt] [options]

Arguments:
  prompt              Task to perform (can also use -p/--prompt)

Options:
  -p, --prompt <text>      Task to perform
  -i, --intensity <level>  low | medium | high | auto  (default: auto)
      --yolo               Skip all confirmation prompts
      --plan               Start with plan mode on
      --cwd <path>         Working directory (default: current dir)
      --max-iter <n>       Override max agent iterations
      --model <name>       Model to use (default: mercury-2)
      --debug              Enable debug logging (or set DEBUG=mercury)
  -v, --version            Show version
  -h, --help               Show help

Authentication:
  INCEPTION_API_KEY env var  (preferred)
  ~/.mercury2/config.json    (saved after first interactive prompt)
```

---

## Architecture

```
User prompt
    │
    ▼
┌─────────────┐
│   Planner   │  ── Mercury-2 API ──▶  JSON Plan (goal + ordered steps)
└─────────────┘
    │
    ▼
┌──────────────┐
│   Executor   │  ── Mercury-2 API ──▶  Tool calls (agentic loop)
└──────────────┘
    │
    ▼
┌──────────────────────────────────────────────┐
│  Tools: read · write · edit · shell · grep   │
│         glob · git · npm                     │
└──────────────────────────────────────────────┘
    │
    ▼
 AgentResult (status + summary + observations)
```

The agent runs a **planner → executor** loop:

1. **Planner** calls Mercury-2 once to decompose the task into a JSON plan with ordered steps.
2. **Executor** runs each step via an inner tool-call loop — calling Mercury-2 with tool definitions, dispatching tool calls, appending results, until `finish_reason = "stop"`.
3. HITL checks gate every write/execute operation before it runs.

---

## Why Mercury-2?

### Speed

Mercury-2 is a diffusion language model — it generates tokens in parallel rather than left-to-right. For agentic coding tasks that involve multiple file reads, edits, and test runs, this translates to meaningfully faster end-to-end task completion compared to autoregressive models.

### Cost Efficiency

Mercury-2 is priced competitively versus GPT-4 class models. For teams running many autonomous coding tasks per day, the cost difference compounds quickly.

### Comparison

| Tool | Model | Architecture | Open Source CLI | HITL |
|------|-------|-------------|----------------|------|
| mercury-2-code-cli | Mercury-2 (Inception) | Diffusion LM | Yes | Yes |
| Aider | GPT-4/Claude/etc | Autoregressive | Yes | Partial |
| Claude Code | Claude (Anthropic) | Autoregressive | No (compiled) | Yes |
| Cursor | GPT-4/Claude | Autoregressive | No | Partial |
| Copilot CLI | GPT-4 | Autoregressive | No | No |

---

## Configuration

The CLI stores config at `~/.mercury2/config.json` (created with chmod 600):

```json
{
  "apiKey": "sk-...",
  "defaultIntensity": "auto",
  "defaultModel": "mercury-2"
}
```

You can edit this file manually or let the CLI write to it on first run.

---

## Contributing

Pull requests welcome. Please open an issue first for large changes.

```bash
git clone https://github.com/your-org/mercury-2-code-cli
cd mercury-2-code-cli
npm install
npm run build
node dist/bin/mercury.js --help
```

---

## Disclaimer

This is an unofficial community project and is **not affiliated with or endorsed by Inception Labs**. Mercury-2 is a product of [Inception Labs](https://www.inceptionlabs.ai/). This CLI is provided as-is under the MIT license.

For questions or feedback: diegorodriguez93@hotmail.com

---

## License

MIT © 2025

---

mercury-2 CLI, inception labs coding assistant, autonomous coding agent, diffusion LLM code generation, AI terminal tool, agentic coding TypeScript, fastest AI code generation, AI pair programmer terminal, open source AI coding CLI, mercury-2-code-cli npm, Node.js AI agent, AI code refactoring tool

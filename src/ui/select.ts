export type SelectResult =
  | { type: 'selected'; index: number }
  | { type: 'custom'; text: string }
  | { type: 'cancelled' };

/**
 * Interactive arrow-key selection widget. Uses raw stdin — no readline.createInterface,
 * so it does not conflict with or kill the outer REPL readline interface.
 *
 * Note: readline with terminal:true calls setRawMode(true) itself. We snapshot the
 * current raw-mode state and restore it on exit, so readline's state is preserved.
 */
export async function promptSelect(
  title: string,
  options: string[],
  defaultIndex = 0,
  customLabel?: string,
): Promise<SelectResult> {
  // Non-TTY fallback: auto-select default without interaction
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return { type: 'selected', index: defaultIndex };
  }

  const allOptions = customLabel ? [...options, customLabel] : options;
  const customIndex = customLabel ? allOptions.length - 1 : -1;

  // Snapshot raw mode so we can restore it exactly (readline sets it to true itself)
  const previousRaw: boolean = (process.stdin as NodeJS.ReadStream & { isRaw?: boolean }).isRaw ?? false;

  return new Promise<SelectResult>((resolve) => {
    let selected = defaultIndex;
    let linesRendered = 0;

    const render = () => {
      if (linesRendered > 0) {
        process.stdout.write(`\x1b[${linesRendered}A\x1b[0J`);
      }
      const lines: string[] = [];
      if (title) lines.push(title);
      for (let i = 0; i < allOptions.length; i++) {
        const cursor = i === selected ? '\x1b[36m❯\x1b[0m' : ' ';
        const label =
          i === selected
            ? `\x1b[1m${allOptions[i]}\x1b[0m`
            : `\x1b[90m${allOptions[i]}\x1b[0m`;
        lines.push(`  ${cursor} ${label}`);
      }
      process.stdout.write(lines.join('\n') + '\n');
      linesRendered = lines.length;
    };

    // Restore stdin to the state it was in before we took over
    const done = (result: SelectResult) => {
      process.stdin.setRawMode(previousRaw);
      resolve(result);
    };

    const startTextInput = () => {
      process.stdout.write('  > ');
      let text = '';

      const inputHandler = (b: Buffer) => {
        const k = b.toString();
        if (k === '\r' || k === '\n') {
          process.stdin.removeListener('data', inputHandler);
          process.stdout.write('\n');
          done({ type: 'custom', text: text.trim() });
        } else if (k === '\x7f' || k === '\b') {
          if (text.length > 0) {
            text = text.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (k === '\x03' || k === '\x1b') {
          process.stdin.removeListener('data', inputHandler);
          process.stdout.write('\n');
          done({ type: 'cancelled' });
        } else if (k.charCodeAt(0) >= 32) {
          text += k;
          process.stdout.write(k);
        }
      };

      process.stdin.on('data', inputHandler);
    };

    const handler = (buf: Buffer) => {
      const key = buf.toString();

      if (key === '\x1b[A') {
        // Up arrow
        selected = (selected - 1 + allOptions.length) % allOptions.length;
        render();
      } else if (key === '\x1b[B') {
        // Down arrow
        selected = (selected + 1) % allOptions.length;
        render();
      } else if (key === '\r' || key === '\n') {
        // Enter
        process.stdin.removeListener('data', handler);
        if (selected === customIndex) {
          startTextInput();
        } else {
          done({ type: 'selected', index: selected });
        }
      } else if (key === '\x1b' || key === '\x03') {
        // Escape or Ctrl+C
        process.stdin.removeListener('data', handler);
        process.stdout.write('\n');
        done({ type: 'cancelled' });
      }
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', handler);
    render();
  });
}

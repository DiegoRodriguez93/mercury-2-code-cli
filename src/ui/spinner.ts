const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class Spinner {
  private frame = 0;
  private timer: NodeJS.Timeout | null = null;
  private text: string;
  private active = false;

  constructor(text: string) {
    this.text = text;
  }

  start(): void {
    if (!process.stderr.isTTY) return;
    this.active = true;
    this.render();
    this.timer = setInterval(() => this.render(), 80);
  }

  update(text: string): void {
    this.text = text;
  }

  stop(finalText?: string): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.active && process.stderr.isTTY) {
      process.stderr.write('\r\x1b[K'); // clear line
    }
    this.active = false;
    if (finalText) {
      process.stderr.write(finalText + '\n');
    }
  }

  private render(): void {
    const frame = FRAMES[this.frame % FRAMES.length] ?? '·';
    this.frame++;
    process.stderr.write(`\r\x1b[36m${frame}\x1b[0m ${this.text}`);
  }
}

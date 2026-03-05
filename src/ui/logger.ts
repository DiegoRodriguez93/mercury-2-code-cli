const DEBUG = process.env['DEBUG']?.includes('mercury') ?? false;

function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  debug(msg: string, ...args: unknown[]): void {
    if (DEBUG) {
      process.stderr.write(`[${timestamp()}] DEBUG ${msg} ${args.map(String).join(' ')}\n`);
    }
  },
  info(msg: string, ...args: unknown[]): void {
    process.stderr.write(`[mercury] ${msg} ${args.map(String).join(' ')}\n`);
  },
  warn(msg: string, ...args: unknown[]): void {
    process.stderr.write(`[mercury:warn] ${msg} ${args.map(String).join(' ')}\n`);
  },
  error(msg: string, ...args: unknown[]): void {
    process.stderr.write(`[mercury:error] ${msg} ${args.map(String).join(' ')}\n`);
  },
};

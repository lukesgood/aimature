export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

const ORDER: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

export interface Logger {
  error(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  debug(msg: string, meta?: Record<string, unknown>): void;
}

export interface LoggerOptions {
  level?: LogLevel;
  /** Sink for log lines. Defaults to stderr so it never pollutes report stdout. */
  write?: (s: string) => void;
}

/**
 * A tiny levelled logger. Lines are written to the sink as
 * `[aim] LEVEL message {json-meta}` and gated by the configured level so a
 * normal run stays quiet while `--verbose` surfaces per-layer diagnostics.
 */
export function createLogger(opts: LoggerOptions = {}): Logger {
  const threshold = ORDER[opts.level ?? 'warn'];
  const write = opts.write ?? ((s: string) => { process.stderr.write(s); });

  const emit = (level: Exclude<LogLevel, 'silent'>, msg: string, meta?: Record<string, unknown>): void => {
    if (ORDER[level] > threshold) return;
    const suffix = meta && Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    write(`[aim] ${level.toUpperCase()} ${msg}${suffix}\n`);
  };

  return {
    error: (m, meta) => emit('error', m, meta),
    warn: (m, meta) => emit('warn', m, meta),
    info: (m, meta) => emit('info', m, meta),
    debug: (m, meta) => emit('debug', m, meta),
  };
}

/** A logger that discards everything — the default for library callers. */
export const silentLogger: Logger = createLogger({ level: 'silent' });

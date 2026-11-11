export type LogLevel = 'info' | 'warn' | 'error';
export type LogSink = (level: LogLevel, message: string, ...details: unknown[]) => void;

const consoleSink: LogSink = (level, message, ...details) => {
  console[level](`[buedchensim] ${message}`, ...details);
};

let sink: LogSink = consoleSink;

/** Replaces the log sink (e.g. in tests). Returns a function restoring the previous sink. */
export function setLogSink(next: LogSink): () => void {
  const previous = sink;
  sink = next;
  return () => {
    sink = previous;
  };
}

export const log = {
  info: (message: string, ...details: unknown[]): void => sink('info', message, ...details),
  warn: (message: string, ...details: unknown[]): void => sink('warn', message, ...details),
  error: (message: string, ...details: unknown[]): void => sink('error', message, ...details),
};

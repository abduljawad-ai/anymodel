/**
 * Structured logging utility for Relay.
 * Provides consistent logging format with levels and context.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  data?: unknown;
  timestamp: string;
}

const LOG_BUFFER: LogEntry[] = [];
const MAX_BUFFER_SIZE = 100;

function formatEntry(entry: LogEntry): string {
  const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
  const context = entry.context ? ` [${entry.context}]` : '';
  return `${prefix}${context} ${entry.message}`;
}

function addEntry(level: LogLevel, message: string, context?: string, data?: unknown): void {
  const entry: LogEntry = {
    level,
    message,
    context,
    data,
    timestamp: new Date().toISOString(),
  };

  LOG_BUFFER.push(entry);
  if (LOG_BUFFER.length > MAX_BUFFER_SIZE) {
    LOG_BUFFER.shift();
  }

  // Console output
  const formatted = formatEntry(entry);
  switch (level) {
    case 'debug':
      console.debug(formatted, data ?? '');
      break;
    case 'info':
      console.info(formatted, data ?? '');
      break;
    case 'warn':
      console.warn(formatted, data ?? '');
      break;
    case 'error':
      console.error(formatted, data ?? '');
      break;
  }
}

export const logger = {
  debug(message: string, context?: string, data?: unknown) {
    addEntry('debug', message, context, data);
  },
  info(message: string, context?: string, data?: unknown) {
    addEntry('info', message, context, data);
  },
  warn(message: string, context?: string, data?: unknown) {
    addEntry('warn', message, context, data);
  },
  error(message: string, context?: string, data?: unknown) {
    addEntry('error', message, context, data);
  },
  /** Get recent log entries for error reporting. */
  getRecent(count = 20): LogEntry[] {
    return LOG_BUFFER.slice(-count);
  },
  /** Clear log buffer. */
  clear(): void {
    LOG_BUFFER.length = 0;
  },
};

/**
 * Tagged logger utility.
 *
 * makeLogRecord and formatLogRecord are pure functions (no side effects).
 * createLogger is a factory; the returned Logger methods emit to console
 * but carry no global mutable state.
 *
 * All functions are const arrow expressions.
 * No null, no exceptions, every if has an else.
 */

export type LogLevel = "error" | "warn" | "info" | "debug";

export interface LogRecord {
  readonly level: LogLevel;
  readonly tag: string;
  readonly message: string;
}

export interface Logger {
  readonly error: (message: string) => void;
  readonly warn: (message: string) => void;
  readonly info: (message: string) => void;
  readonly debug: (message: string) => void;
}

/** Pure: construct a log record. */
export const makeLogRecord = (
  level: LogLevel,
  tag: string,
  message: string,
): LogRecord => ({ level, tag, message });

/** Pure: format a log record to a single line string. */
export const formatLogRecord = ({ level, tag, message }: LogRecord): string =>
  `[${level.toUpperCase()}][${tag}] ${message}`;

/** Create a tagged logger that emits each level to the matching console method. */
export const createLogger = (tag: string): Logger => ({
  error: (msg) => console.error(formatLogRecord(makeLogRecord("error", tag, msg))),
  warn:  (msg) => console.warn(formatLogRecord(makeLogRecord("warn",  tag, msg))),
  info:  (msg) => console.info(formatLogRecord(makeLogRecord("info",  tag, msg))),
  debug: (msg) => console.debug(formatLogRecord(makeLogRecord("debug", tag, msg))),
});

type LogLevel = "debug" | "info" | "warn" | "error";

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Formats a log prefix with an ISO timestamp and level label.
 *
 * @param level - Log severity level
 * @returns Prefixed log label string
 */
function formatPrefix(level: LogLevel): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}]`;
}

/**
 * Writes a development log entry to the console with a timestamp.
 *
 * @param level - Log severity level
 * @param message - Human-readable message
 * @param data - Optional structured payload
 */
function logInDevelopment(
  level: LogLevel,
  message: string,
  data?: unknown,
): void {
  const prefix = formatPrefix(level);
  const payload = data === undefined ? [prefix, message] : [prefix, message, data];

  switch (level) {
    case "debug":
      console.debug(...payload);
      break;
    case "info":
      console.info(...payload);
      break;
    case "warn":
      console.warn(...payload);
      break;
    case "error":
      console.error(...payload);
      break;
  }
}

/**
 * Logs a debug message. Emitted only in development.
 *
 * @param message - Human-readable message
 * @param data - Optional structured payload
 */
export function logDebug(message: string, data?: unknown): void {
  if (!isDevelopment) return;
  logInDevelopment("debug", message, data);
}

/**
 * Logs an informational message. Emitted only in development.
 *
 * @param message - Human-readable message
 * @param data - Optional structured payload
 */
export function logInfo(message: string, data?: unknown): void {
  if (!isDevelopment) return;
  logInDevelopment("info", message, data);
}

/**
 * Logs a warning. Emitted only in development.
 *
 * @param message - Human-readable message
 * @param data - Optional structured payload
 */
export function logWarn(message: string, data?: unknown): void {
  if (!isDevelopment) return;
  logInDevelopment("warn", message, data);
}

/**
 * Logs an error. Always emitted; uses `console.error` in all environments.
 *
 * @param message - Human-readable message
 * @param data - Optional structured payload
 */
export function logError(message: string, data?: unknown): void {
  if (isDevelopment) {
    logInDevelopment("error", message, data);
    return;
  }

  if (data === undefined) {
    console.error(message);
  } else {
    console.error(message, data);
  }
}

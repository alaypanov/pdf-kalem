/**
 * Internal debug logging helper.
 *
 * All non-error diagnostic output (render traces, layout dimensions, etc.)
 * should go through {@link debugLog} so it is gated behind the backend's
 * `debug` flag. Consumers who construct a `PdfDoc({ debug: false })` (the
 * default) will never see this output in their console.
 *
 * Genuine error/warning paths (font fallbacks, failed fetches, etc.) still
 * use `console.error` / `console.warn` directly — those should always surface.
 */

let debugEnabled = false;

/**
 * Enables or disables debug logging globally. Called by backends (e.g.
 * `PdfRenderContext.setDebug`) when the `debug` option is toggled.
 */
export function setDebugEnabled(enabled: boolean): void {
  debugEnabled = !!enabled;
}

/**
 * Returns whether debug logging is currently enabled.
 */
export function isDebugEnabled(): boolean {
  return debugEnabled;
}

/**
 * Logs a debug message (and optional args) to `console.debug` only when
 * debug logging is enabled. No-op otherwise.
 */
export function debugLog(message: string, ...args: unknown[]): void {
  if (!debugEnabled) return;
  // `console.debug` is filtered out of default browser console verbosity,
  // which is the right behavior for trace-level output.
  console.debug(message, ...args);
}

/**
 * Coerce an arbitrary thrown value into a safe log string. Always returns
 * just `error.message` for Error instances (never JSON.stringify the whole
 * object — stack frames and surrounding state can leak secrets), and
 * `String(err)` for everything else.
 *
 * Used by the orchestrator (PAI-129) when it catches per-skill failures
 * and wants to surface them through `core.error` or `core.warning` without
 * widening the leak surface.
 */
export function safeMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Format `prefix: message` from an arbitrary thrown value, ready to pass
 * to `core.error` / `core.warning` / etc. Saves the
 * `${prefix}: ${safeMessage(err)}` template at every call site.
 */
export function formatError(prefix: string, err: unknown): string {
  return `${prefix}: ${safeMessage(err)}`
}

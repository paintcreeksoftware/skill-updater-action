import { readFile } from 'node:fs/promises'

/**
 * Pre-write idempotency check. Returns `true` if writing `desired` to
 * `filePath` would actually change something (file is missing OR has
 * different content); returns `false` if existing content is byte-identical
 * to `desired`.
 *
 * Used by the orchestrator (PAI-129) to skip per-skill writes when synthesis
 * produced unchanged output, and by the rolling-PR commit step to short-
 * circuit the whole commit/push/PR pipeline when no skill changed.
 */
export async function wouldChange(
  filePath: string,
  desired: string
): Promise<boolean> {
  try {
    const current = await readFile(filePath, 'utf8')
    return current !== desired
  } catch {
    // Most commonly ENOENT (file doesn't exist yet); writing creates it,
    // which is by definition a change. Any other read error is also handled
    // here because we'd surface it on the actual write anyway.
    return true
  }
}

/**
 * Project-wide typed const objects. Lifted out of inline string literals so
 * comparisons are checked at compile time and a single grep finds every usage
 * site.
 */

/**
 * The set of upstream source kinds the action knows how to fetch.
 *
 * Used as the discriminant in {@link
 * https://github.com/colinhacks/zod | zod}'s `discriminatedUnion` for the
 * `sources` input schema, and as the dispatch key in the source fetcher
 * (PAI-126 / PAI-127).
 */
export const SourceType = {
  Web: 'web',
  Git: 'git',
  Rss: 'rss'
} as const

/**
 * Union of valid {@link SourceType} string values.
 */
export type SourceTypeValue = (typeof SourceType)[keyof typeof SourceType]

/**
 * Process exit codes the action can produce. The action does not call
 * `process.exit` directly — `core.setFailed` handles non-zero exits — but
 * these constants document the intended exit semantics for the orchestrator
 * (PAI-129) and the failure-mode tests.
 */
export const ExitCode = {
  /** Action completed successfully (PR opened or no-op exit). */
  Success: 0,
  /** Generic failure: parser error, fetch error, synthesis error. */
  Failure: 1
} as const

/**
 * Union of valid {@link ExitCode} numeric values.
 */
export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode]

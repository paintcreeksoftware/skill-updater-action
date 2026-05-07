import type { Source } from '../config/inputs.js'

export type { Source }

/**
 * One document fetched from an upstream source. The fetcher concatenates
 * these per skill before handing them to the synthesis prompt builder
 * (PAI-128) — the {@link sourceUrl} and {@link fetchedAt} fields surface as
 * provenance headers (`<doc src="..." fetched-at="...">…</doc>`) inside the
 * cached prompt block so the model can attribute claims back to specific
 * upstream documents.
 */
export interface FetchedDocument {
  /**
   * The URL the document was fetched from. For git sources this is
   * `<repo-url>#<ref>:<path>` so an individual file inside a repo can still
   * be cited unambiguously; for RSS this is the feed URL with the item's
   * GUID appended.
   */
  readonly sourceUrl: string
  /**
   * MIME-style content type if the source supplied one (`text/html`,
   * `text/markdown`, `application/json`, …); empty string when unknown.
   * Currently informational only — the synthesis prompt doesn't dispatch
   * on it.
   */
  readonly contentType: string
  /** The document body, decoded as UTF-8. */
  readonly body: string
  /** Wall-clock timestamp of the fetch (used in the provenance header). */
  readonly fetchedAt: Date
}

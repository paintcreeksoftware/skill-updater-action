import { SourceType } from '../config/constants.js'
import type { FetchedDocument, Source } from './types.js'
import { fetchWeb } from './web.js'

/**
 * Dispatch a {@link Source} to the right per-type fetcher. Returns an array
 * even for sources that only ever produce one document so the orchestrator
 * (PAI-129) can flatten without a special case.
 *
 * Git and RSS branches throw `NotImplemented`-style errors until PAI-127
 * lands the actual fetchers — the discriminator switch is exhaustive
 * already so adding the implementations is just replacing the throws.
 *
 * @throws If the source type is `git` or `rss` (until PAI-127), or if the
 * underlying fetcher throws (HTTP error, timeout, network failure).
 */
export async function fetchSource(source: Source): Promise<FetchedDocument[]> {
  switch (source.type) {
    case SourceType.Web:
      return [await fetchWeb(source.url)]
    case SourceType.Git:
      throw new Error(
        `source type 'git' not yet implemented — see PAI-127 for the git fetcher`
      )
    case SourceType.Rss:
      throw new Error(
        `source type 'rss' not yet implemented — see PAI-127 for the rss fetcher`
      )
  }
}

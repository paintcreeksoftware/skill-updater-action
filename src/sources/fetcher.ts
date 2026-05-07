import { SourceType } from '../config/constants.js'
import { fetchGit } from './git.js'
import { fetchRss } from './rss.js'
import type { FetchedDocument, Source } from './types.js'
import { fetchWeb } from './web.js'

/**
 * Dispatch a {@link Source} to the right per-type fetcher. Returns an array
 * even for sources that only ever produce one document so the orchestrator
 * (PAI-129) can flatten without a special case.
 *
 * @throws If the underlying fetcher throws (HTTP error, timeout, clone
 * failure, RSS parse failure, etc.). The orchestrator catches and reports
 * per-skill so one source's failure doesn't poison sibling skills.
 */
export async function fetchSource(source: Source): Promise<FetchedDocument[]> {
  switch (source.type) {
    case SourceType.Web:
      return [await fetchWeb(source.url)]
    case SourceType.Git:
      return fetchGit(source.url, source.ref, source.paths)
    case SourceType.Rss:
      return fetchRss(source.url, source['max-items'])
  }
}

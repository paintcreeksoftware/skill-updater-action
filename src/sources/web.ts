import * as core from '@actions/core'
import { request } from 'undici'
import type { FetchedDocument } from './types.js'

/**
 * Per-request fetch budget. A hardcoded constant rather than an action
 * input — the plan explicitly demoted this from input to default; bad-actor
 * sources that hang shouldn't be configurable by the workflow author into
 * burning the entire Actions runner budget.
 */
const FETCH_TIMEOUT_MS = 20_000

/**
 * Fetch a single web URL and return its body as a {@link FetchedDocument}.
 *
 * Three failure modes, all surfaced as thrown Errors so the orchestrator
 * (PAI-129) can fail the run loudly rather than silently shipping stale
 * skills:
 *
 * - **HTTP ≥ 400**: thrown with the URL and status code.
 * - **AbortSignal.timeout fires** (default 20s): a `core.warning` is logged
 *   with the offending URL so a human watching the Action log knows which
 *   fetch hung, then the underlying timeout error is rethrown wrapped.
 * - **Network/connection error**: rethrown wrapped, with the original error
 *   attached as `cause`.
 *
 * @param url - Absolute URL to GET. Must include scheme.
 * @returns Body decoded as UTF-8, packaged with URL/`content-type`/fetch
 * timestamp.
 */
export async function fetchWeb(url: string): Promise<FetchedDocument> {
  const fetchedAt = new Date()
  let response: Awaited<ReturnType<typeof request>>
  try {
    response = await request(url, {
      method: 'GET',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError')
      core.warning(`fetch timeout (${FETCH_TIMEOUT_MS}ms) for ${url}`)
    throw new Error(
      `failed to fetch ${url}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err }
    )
  }
  if (response.statusCode >= 400)
    throw new Error(`${url} returned HTTP ${response.statusCode}`)
  const body = await response.body.text()
  return {
    sourceUrl: url,
    contentType: stringHeader(response.headers['content-type']),
    body,
    fetchedAt
  }
}

/**
 * Coerce undici's `IncomingHttpHeaders[name]` (which can be string,
 * string[], or undefined) into a single string. Multi-value headers are
 * joined with `, ` per RFC 9110 §5.3.
 */
function stringHeader(value: string | string[] | undefined): string {
  if (value === undefined) return ''
  return Array.isArray(value) ? value.join(', ') : value
}

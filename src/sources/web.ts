import { request } from 'undici'
import type { FetchedDocument } from './types.js'

/**
 * Fetch a single web URL and return its body as a {@link FetchedDocument}.
 *
 * v1 happy path only — the status check, timeout, and network-error
 * wrapping land in the next commit. Anyone consuming this module before
 * that commit gets a fetcher that returns whatever the server responds
 * with, even on 404/500.
 *
 * @param url - The URL to GET. Must be absolute (`https://…` or `http://…`).
 * @returns The response body decoded as UTF-8, packaged with the URL,
 * `content-type` header, and a fresh fetch timestamp.
 */
export async function fetchWeb(url: string): Promise<FetchedDocument> {
  const fetchedAt = new Date()
  const response = await request(url, { method: 'GET' })
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

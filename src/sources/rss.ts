import Parser from 'rss-parser'
import type { FetchedDocument } from './types.js'

/**
 * Default item cap when the source doesn't set `max-items`. RSS feeds vary
 * wildly in length (5 items for a press feed; 100+ for a release-changelog
 * feed); 20 is a reasonable upper bound that keeps the synthesis prompt
 * from blowing past Claude's context for a single skill.
 */
const DEFAULT_MAX_ITEMS = 20

/**
 * Fetch an RSS/Atom feed and emit one {@link FetchedDocument} per item
 * (capped at `maxItems` or the {@link DEFAULT_MAX_ITEMS}). Each document's
 * body opens with a provenance header so the synthesis prompt can attribute
 * claims back to specific feed items:
 *
 *     <doc src="<feed-url>" item="<title>" published="<iso-date>">
 *     ...item content...
 *     </doc>
 *
 * Title and date attributes are escaped to keep stray quotes inside titles
 * from breaking the header.
 *
 * @param url - The feed URL (RSS 2.0 or Atom).
 * @param maxItems - Cap on items returned (newest first per feed order).
 */
export async function fetchRss(
  url: string,
  maxItems?: number
): Promise<FetchedDocument[]> {
  const fetchedAt = new Date()
  const parser = new Parser()
  const feed = await parser.parseURL(url)
  const limit = maxItems ?? DEFAULT_MAX_ITEMS
  const items = (feed.items ?? []).slice(0, limit)

  return items.map((item) => {
    const title = escapeAttr(item.title ?? '')
    const published = item.isoDate ?? item.pubDate ?? ''
    const content = item.content ?? item.contentSnippet ?? ''
    return {
      sourceUrl: url,
      contentType: 'application/rss+xml',
      body: `<doc src="${url}" item="${title}" published="${published}">\n${content}\n</doc>`,
      fetchedAt
    }
  })
}

/** Quote escapes for safe embedding in an XML-style attribute value. */
function escapeAttr(value: string): string {
  return value.replace(/"/g, '&quot;')
}

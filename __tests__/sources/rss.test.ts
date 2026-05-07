/**
 * Unit tests for src/sources/rss.ts.
 *
 * rss-parser is mocked at the module boundary so these tests don't actually
 * make a network request. The next commit adds edge-case tests (max-items
 * truncation, empty feeds, parse failures, attribute escaping).
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals'

const parseURL = jest.fn<(url: string) => Promise<unknown>>()
class MockParser {
  parseURL = parseURL
}
jest.unstable_mockModule('rss-parser', () => ({ default: MockParser }))

const { fetchRss } = await import('../../src/sources/rss.js')

beforeEach(() => {
  jest.resetAllMocks()
})

function feedWithItems(count: number): unknown {
  return {
    items: Array.from({ length: count }, (_, i) => ({
      title: `Item ${i}`,
      isoDate: '2026-05-01T00:00:00Z',
      content: `body ${i}`
    }))
  }
}

describe('fetchRss (happy path)', () => {
  it('emits one FetchedDocument per item with provenance header', async () => {
    parseURL.mockResolvedValueOnce({
      items: [
        {
          title: 'Release v1.2.3',
          isoDate: '2026-05-01T00:00:00Z',
          content: 'Release notes for v1.2.3'
        },
        {
          title: 'Release v1.2.2',
          isoDate: '2026-04-15T00:00:00Z',
          content: 'Release notes for v1.2.2'
        }
      ]
    })

    const docs = await fetchRss('https://example.com/feed.xml')

    expect(parseURL).toHaveBeenCalledWith('https://example.com/feed.xml')
    expect(docs).toHaveLength(2)
    expect(docs[0]).toMatchObject({
      sourceUrl: 'https://example.com/feed.xml',
      contentType: 'application/rss+xml'
    })
    expect(docs[0].body).toContain(
      '<doc src="https://example.com/feed.xml" item="Release v1.2.3" published="2026-05-01T00:00:00Z">'
    )
    expect(docs[0].body).toContain('Release notes for v1.2.3')
    expect(docs[0].body).toContain('</doc>')
    expect(docs[0].fetchedAt).toBeInstanceOf(Date)
  })
})

describe('fetchRss (edge cases)', () => {
  it('caps the result at the default 20 items when maxItems is unset', async () => {
    parseURL.mockResolvedValueOnce(feedWithItems(50))
    const docs = await fetchRss('https://x/feed')
    expect(docs).toHaveLength(20)
  })

  it('honors an explicit maxItems', async () => {
    parseURL.mockResolvedValueOnce(feedWithItems(50))
    const docs = await fetchRss('https://x/feed', 5)
    expect(docs).toHaveLength(5)
  })

  it('returns an empty array when the feed has no items', async () => {
    parseURL.mockResolvedValueOnce({ items: [] })
    expect(await fetchRss('https://x/empty')).toEqual([])
  })

  it('handles a feed with the items field missing entirely', async () => {
    parseURL.mockResolvedValueOnce({})
    expect(await fetchRss('https://x/malformed')).toEqual([])
  })

  it('escapes double quotes inside item titles', async () => {
    parseURL.mockResolvedValueOnce({
      items: [
        {
          title: 'A title with "quotes" inside',
          isoDate: '2026-05-01T00:00:00Z',
          content: 'body'
        }
      ]
    })
    const [doc] = await fetchRss('https://x/feed')
    expect(doc.body).toContain('item="A title with &quot;quotes&quot; inside"')
  })

  it('falls back to pubDate when isoDate is missing, and contentSnippet when content is missing', async () => {
    parseURL.mockResolvedValueOnce({
      items: [
        {
          title: 'Snippet only',
          pubDate: 'Wed, 30 Apr 2026 12:00:00 GMT',
          contentSnippet: 'just the snippet'
        }
      ]
    })
    const [doc] = await fetchRss('https://x/feed')
    expect(doc.body).toContain('published="Wed, 30 Apr 2026 12:00:00 GMT"')
    expect(doc.body).toContain('just the snippet')
  })

  it('rethrows when rss-parser fails to parse the feed', async () => {
    parseURL.mockRejectedValueOnce(new Error('feed is not XML'))
    await expect(fetchRss('https://x/bad')).rejects.toThrow(/feed is not XML/)
  })
})

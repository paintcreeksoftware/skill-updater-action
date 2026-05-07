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

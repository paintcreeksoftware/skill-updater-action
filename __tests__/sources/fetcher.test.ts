/**
 * Unit tests for src/sources/fetcher.ts.
 *
 * The web fetcher is mocked at the module boundary; these tests assert the
 * dispatcher calls the right per-type fetcher and surfaces the
 * not-yet-implemented errors for git/rss until PAI-127 fills them in.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import type { fetchWeb as FetchWeb } from '../../src/sources/web.js'

const fetchWeb = jest.fn<typeof FetchWeb>()
jest.unstable_mockModule('../../src/sources/web.js', () => ({ fetchWeb }))

const { fetchSource } = await import('../../src/sources/fetcher.js')

beforeEach(() => {
  jest.resetAllMocks()
})

describe('fetchSource', () => {
  it('dispatches web sources to fetchWeb and wraps the result in an array', async () => {
    const doc = {
      sourceUrl: 'https://x',
      contentType: '',
      body: 'b',
      fetchedAt: new Date()
    }
    fetchWeb.mockResolvedValueOnce(doc)

    const out = await fetchSource({ type: 'web', url: 'https://x' })

    expect(fetchWeb).toHaveBeenCalledWith('https://x')
    expect(out).toEqual([doc])
  })

  it('throws NotImplemented for git sources (PAI-127 lands the fetcher)', async () => {
    await expect(
      fetchSource({ type: 'git', url: 'https://github.com/x/y.git' })
    ).rejects.toThrow(/git.*not yet implemented.*PAI-127/)
  })

  it('throws NotImplemented for rss sources (PAI-127 lands the fetcher)', async () => {
    await expect(
      fetchSource({ type: 'rss', url: 'https://x/feed.xml' })
    ).rejects.toThrow(/rss.*not yet implemented.*PAI-127/)
  })
})

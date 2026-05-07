/**
 * Unit tests for src/sources/fetcher.ts.
 *
 * All three per-type fetchers are mocked at the module boundary so this
 * suite stays focused on the dispatcher's switch behavior — the per-fetcher
 * suites (web/git/rss) cover their own internals.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import type { fetchWeb as FetchWeb } from '../../src/sources/web.js'
import type { fetchGit as FetchGit } from '../../src/sources/git.js'
import type { fetchRss as FetchRss } from '../../src/sources/rss.js'

const fetchWeb = jest.fn<typeof FetchWeb>()
const fetchGit = jest.fn<typeof FetchGit>()
const fetchRss = jest.fn<typeof FetchRss>()

jest.unstable_mockModule('../../src/sources/web.js', () => ({ fetchWeb }))
jest.unstable_mockModule('../../src/sources/git.js', () => ({ fetchGit }))
jest.unstable_mockModule('../../src/sources/rss.js', () => ({ fetchRss }))

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

  it('forwards ref and paths when dispatching a git source', async () => {
    fetchGit.mockResolvedValueOnce([])
    await fetchSource({
      type: 'git',
      url: 'https://github.com/x/y.git',
      ref: 'main',
      paths: ['docs/**']
    })
    expect(fetchGit).toHaveBeenCalledWith(
      'https://github.com/x/y.git',
      'main',
      ['docs/**']
    )
  })

  it('forwards max-items when dispatching an rss source', async () => {
    fetchRss.mockResolvedValueOnce([])
    await fetchSource({
      type: 'rss',
      url: 'https://x/feed.xml',
      'max-items': 5
    })
    expect(fetchRss).toHaveBeenCalledWith('https://x/feed.xml', 5)
  })

  it('passes undefined ref/paths/max-items through cleanly', async () => {
    fetchGit.mockResolvedValueOnce([])
    fetchRss.mockResolvedValueOnce([])
    await fetchSource({ type: 'git', url: 'https://x/y.git' })
    await fetchSource({ type: 'rss', url: 'https://x/feed' })
    expect(fetchGit).toHaveBeenCalledWith(
      'https://x/y.git',
      undefined,
      undefined
    )
    expect(fetchRss).toHaveBeenCalledWith('https://x/feed', undefined)
  })
})

/**
 * Unit tests for src/sources/web.ts.
 *
 * undici is mocked at the module boundary so each test controls the
 * response shape directly. The next commit adds error-path tests
 * (status check, network failure, timeout); this commit covers the
 * happy path only.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import type { request as UndiciRequest } from 'undici'

const request = jest.fn<typeof UndiciRequest>()
jest.unstable_mockModule('undici', () => ({ request }))

const { fetchWeb } = await import('../../src/sources/web.js')

beforeEach(() => {
  jest.resetAllMocks()
})

describe('fetchWeb (happy path)', () => {
  it('returns the body, sourceUrl, and content-type header', async () => {
    request.mockResolvedValueOnce({
      body: { text: async () => '# hello world' },
      headers: { 'content-type': 'text/markdown; charset=utf-8' }
    } as unknown as Awaited<ReturnType<typeof UndiciRequest>>)

    const doc = await fetchWeb('https://example.com/docs')

    expect(request).toHaveBeenCalledWith('https://example.com/docs', {
      method: 'GET'
    })
    expect(doc.sourceUrl).toBe('https://example.com/docs')
    expect(doc.body).toBe('# hello world')
    expect(doc.contentType).toBe('text/markdown; charset=utf-8')
    expect(doc.fetchedAt).toBeInstanceOf(Date)
  })

  it('joins array-valued content-type headers with ", "', async () => {
    request.mockResolvedValueOnce({
      body: { text: async () => 'body' },
      headers: { 'content-type': ['text/html', 'charset=utf-8'] }
    } as unknown as Awaited<ReturnType<typeof UndiciRequest>>)

    const doc = await fetchWeb('https://example.com/x')
    expect(doc.contentType).toBe('text/html, charset=utf-8')
  })

  it('coerces a missing content-type header to ""', async () => {
    request.mockResolvedValueOnce({
      body: { text: async () => 'no header' },
      headers: {}
    } as unknown as Awaited<ReturnType<typeof UndiciRequest>>)

    const doc = await fetchWeb('https://example.com/x')
    expect(doc.contentType).toBe('')
  })
})

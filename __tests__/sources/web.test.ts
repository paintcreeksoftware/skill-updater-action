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
import * as core from '../../__fixtures__/core.js'

const request = jest.fn<typeof UndiciRequest>()
jest.unstable_mockModule('undici', () => ({ request }))
jest.unstable_mockModule('@actions/core', () => core)

const { fetchWeb } = await import('../../src/sources/web.js')

beforeEach(() => {
  jest.resetAllMocks()
})

describe('fetchWeb (happy path)', () => {
  it('returns the body, sourceUrl, and content-type header', async () => {
    request.mockResolvedValueOnce({
      statusCode: 200,
      body: { text: async () => '# hello world' },
      headers: { 'content-type': 'text/markdown; charset=utf-8' }
    } as unknown as Awaited<ReturnType<typeof UndiciRequest>>)

    const doc = await fetchWeb('https://example.com/docs')

    expect(request).toHaveBeenCalledWith('https://example.com/docs', {
      method: 'GET',
      signal: expect.any(AbortSignal)
    })
    expect(doc.sourceUrl).toBe('https://example.com/docs')
    expect(doc.body).toBe('# hello world')
    expect(doc.contentType).toBe('text/markdown; charset=utf-8')
    expect(doc.fetchedAt).toBeInstanceOf(Date)
  })

  it('joins array-valued content-type headers with ", "', async () => {
    request.mockResolvedValueOnce({
      statusCode: 200,
      body: { text: async () => 'body' },
      headers: { 'content-type': ['text/html', 'charset=utf-8'] }
    } as unknown as Awaited<ReturnType<typeof UndiciRequest>>)

    const doc = await fetchWeb('https://example.com/x')
    expect(doc.contentType).toBe('text/html, charset=utf-8')
  })

  it('coerces a missing content-type header to ""', async () => {
    request.mockResolvedValueOnce({
      statusCode: 200,
      body: { text: async () => 'no header' },
      headers: {}
    } as unknown as Awaited<ReturnType<typeof UndiciRequest>>)

    const doc = await fetchWeb('https://example.com/x')
    expect(doc.contentType).toBe('')
  })
})

describe('fetchWeb (failure modes)', () => {
  it('throws when the response status is >= 400', async () => {
    request.mockResolvedValueOnce({
      statusCode: 404,
      body: { text: async () => 'not found' },
      headers: {}
    } as unknown as Awaited<ReturnType<typeof UndiciRequest>>)

    await expect(fetchWeb('https://example.com/missing')).rejects.toThrow(
      /returned HTTP 404/
    )
  })

  it('logs core.warning and throws when AbortSignal.timeout fires', async () => {
    const timeoutErr = new Error('aborted')
    timeoutErr.name = 'TimeoutError'
    request.mockRejectedValueOnce(timeoutErr)

    await expect(fetchWeb('https://slow.example.com/')).rejects.toThrow(
      /failed to fetch.*aborted/s
    )
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('fetch timeout')
    )
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('https://slow.example.com/')
    )
  })

  it('wraps generic network errors without logging a timeout warning', async () => {
    request.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    await expect(fetchWeb('https://nope.example.com/')).rejects.toThrow(
      /failed to fetch.*ECONNREFUSED/s
    )
    expect(core.warning).not.toHaveBeenCalled()
  })
})

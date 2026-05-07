import { describe, it, expect } from '@jest/globals'
import { formatError, safeMessage } from '../../src/util/logger.js'

describe('safeMessage', () => {
  it('returns Error.message for Error instances', () => {
    expect(safeMessage(new Error('boom'))).toBe('boom')
  })

  it('coerces non-Error throws via String()', () => {
    expect(safeMessage('a string')).toBe('a string')
    expect(safeMessage(42)).toBe('42')
    expect(safeMessage(null)).toBe('null')
    expect(safeMessage(undefined)).toBe('undefined')
  })

  it('does not leak Error stack or own props', () => {
    const err = new Error('only the message')
    ;(err as unknown as { secret: string }).secret = 'sk-leaked'
    const msg = safeMessage(err)
    expect(msg).toBe('only the message')
    expect(msg).not.toContain('sk-leaked')
    expect(msg).not.toContain('Error:')
  })
})

describe('formatError', () => {
  it('prefixes the safe message with the supplied label', () => {
    expect(formatError('fetch failed', new Error('ECONNREFUSED'))).toBe(
      'fetch failed: ECONNREFUSED'
    )
  })

  it('works with non-Error throws too', () => {
    expect(formatError('weird', 'rejected as a string')).toBe(
      'weird: rejected as a string'
    )
  })
})

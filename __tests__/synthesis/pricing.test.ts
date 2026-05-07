import { describe, it, expect } from '@jest/globals'
import { estimateCost, sumUsage } from '../../src/synthesis/pricing.js'

const u = (
  partial: Partial<{
    input_tokens: number
    cache_creation_input_tokens: number
    cache_read_input_tokens: number
    output_tokens: number
  }>
) => ({
  input_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  output_tokens: 0,
  service_tier: 'standard',
  ...partial
})

describe('estimateCost', () => {
  it('prices opus-4-7 input + output at the published rate', () => {
    const cost = estimateCost(
      'claude-opus-4-7',
      u({ input_tokens: 1_000_000, output_tokens: 1_000_000 })
    )
    // 1M input @ $15 + 1M output @ $75 = $90
    expect(cost).toBeCloseTo(90, 6)
  })

  it('prices cache_creation higher than input and cache_read lower', () => {
    const cost = estimateCost(
      'claude-opus-4-7',
      u({ cache_creation_input_tokens: 1_000_000 })
    )
    expect(cost).toBeCloseTo(18.75, 6) // cache write tier
    const readCost = estimateCost(
      'claude-opus-4-7',
      u({ cache_read_input_tokens: 1_000_000 })
    )
    expect(readCost).toBeCloseTo(1.5, 6)
  })

  it('returns undefined for unknown models', () => {
    expect(
      estimateCost('claude-future-99', u({ input_tokens: 100 }))
    ).toBeUndefined()
  })

  it('honors the haiku tier (cheapest)', () => {
    const cost = estimateCost(
      'claude-haiku-4-5-20251001',
      u({ input_tokens: 1_000_000 })
    )
    expect(cost).toBeCloseTo(1, 6)
  })
})

describe('sumUsage', () => {
  it('adds the four metered fields field-by-field', () => {
    const total = sumUsage(
      u({ input_tokens: 100, cache_read_input_tokens: 50, output_tokens: 25 }),
      u({
        input_tokens: 200,
        cache_creation_input_tokens: 1000,
        output_tokens: 75
      })
    )
    expect(total.input_tokens).toBe(300)
    expect(total.cache_creation_input_tokens).toBe(1000)
    expect(total.cache_read_input_tokens).toBe(50)
    expect(total.output_tokens).toBe(100)
  })
})

import type Anthropic from '@anthropic-ai/sdk'

/** USD-per-million-tokens for each model dimension we charge against. */
interface ModelPrice {
  readonly input: number
  readonly output: number
  readonly cacheCreate: number
  readonly cacheRead: number
}

/**
 * Per-model price table, USD per 1M tokens. Sourced from Anthropic's
 * published pricing as of 2026-05. Update when Anthropic publishes new
 * tiers; unknown models surface as `undefined` cost (caller logs a
 * warning and skips the dollar column).
 */
const PRICING: Record<string, ModelPrice> = {
  'claude-opus-4-7': {
    input: 15,
    output: 75,
    cacheCreate: 18.75,
    cacheRead: 1.5
  },
  'claude-sonnet-4-6': {
    input: 3,
    output: 15,
    cacheCreate: 3.75,
    cacheRead: 0.3
  },
  'claude-haiku-4-5-20251001': {
    input: 1,
    output: 5,
    cacheCreate: 1.25,
    cacheRead: 0.1
  }
}

/**
 * Estimate USD cost for one usage record against the given model.
 * @returns USD as a number, or `undefined` if the model isn't in the price
 * table (caller should `core.warning` and report tokens-only).
 */
export function estimateCost(
  model: string,
  usage: Anthropic.Messages.Usage
): number | undefined {
  const price = PRICING[model]
  if (price === undefined) return undefined
  const millionsCost =
    usage.input_tokens * price.input +
    usage.cache_creation_input_tokens * price.cacheCreate +
    usage.cache_read_input_tokens * price.cacheRead +
    usage.output_tokens * price.output
  return millionsCost / 1_000_000
}

/** Sum two usage records field-by-field. */
export function sumUsage(
  a: Anthropic.Messages.Usage,
  b: Anthropic.Messages.Usage
): Anthropic.Messages.Usage {
  return {
    ...a,
    input_tokens: a.input_tokens + b.input_tokens,
    cache_creation_input_tokens:
      a.cache_creation_input_tokens + b.cache_creation_input_tokens,
    cache_read_input_tokens:
      a.cache_read_input_tokens + b.cache_read_input_tokens,
    output_tokens: a.output_tokens + b.output_tokens
  }
}

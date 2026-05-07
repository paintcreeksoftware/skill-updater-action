import type { Anthropic } from '@anthropic-ai/sdk'
import type { FetchedDocument } from '../sources/types.js'
import { callClaude } from './client.js'
import { buildPrompt } from './prompt.js'

/** Inputs the orchestrator hands to one per-skill synthesis. */
export interface SynthesisInput {
  readonly apiKey: string
  readonly model: string
  readonly priorSkillMd: string
  readonly priorMarketplaceJson?: string
  readonly fetchedDocs: readonly FetchedDocument[]
}

/**
 * The parsed JSON envelope plus the token-usage record the model returned.
 * `usage` flows through to cost reporting in PAI-129.
 */
export interface SynthesisResult {
  readonly skillMd: string
  readonly marketplaceJson: Record<string, unknown> | null
  readonly summary: string
  readonly usage: Anthropic.Usage
}

/**
 * Run one per-skill synthesis: build the prompt, call the model, extract
 * the text response, parse the JSON envelope, return it alongside the
 * usage record. Errors from any step bubble up unwrapped.
 */
export async function synthesize(
  input: SynthesisInput
): Promise<SynthesisResult> {
  const prompt = buildPrompt({
    priorSkillMd: input.priorSkillMd,
    priorMarketplaceJson: input.priorMarketplaceJson,
    fetchedDocs: input.fetchedDocs
  })
  const response = await callClaude({
    ...prompt,
    apiKey: input.apiKey,
    model: input.model
  })
  const envelope = parseEnvelope(extractText(response))
  return { ...envelope, usage: response.usage }
}

/** Concatenate the response's text blocks; ignore non-text blocks. */
function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
}

const FENCED_JSON_RE = /```(?:json)?\s*\n?([\s\S]*?)\n?```/

/** Strip an optional ```json ... ``` fence and JSON.parse the envelope. */
function parseEnvelope(text: string): {
  skillMd: string
  marketplaceJson: Record<string, unknown> | null
  summary: string
} {
  if (text.length === 0) throw new Error('synthesis response was empty')
  const match = text.match(FENCED_JSON_RE)
  const json = match !== null ? match[1] : text
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (err) {
    throw new Error(
      `synthesis response is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err }
    )
  }
  const obj = parsed as Record<string, unknown> | null
  if (
    obj === null ||
    typeof obj.skillMd !== 'string' ||
    typeof obj.summary !== 'string'
  )
    throw new Error(
      'synthesis envelope missing required fields (skillMd, summary)'
    )
  return {
    skillMd: obj.skillMd,
    marketplaceJson: (obj.marketplaceJson ?? null) as Record<
      string,
      unknown
    > | null,
    summary: obj.summary
  }
}

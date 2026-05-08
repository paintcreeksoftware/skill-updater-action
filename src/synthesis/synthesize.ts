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

const ENVELOPE_TOOL_NAME = 'emit_skill_envelope' as const

/**
 * Tool spec the model is forced to call via `tool_choice`. The
 * `input_schema` enforces the envelope shape on Anthropic's side, so
 * the SDK delivers a typed `input` object via a `tool_use` block —
 * no fenced-JSON text parsing required (the v0.1.0 nested-fence bug).
 */
const ENVELOPE_TOOL = {
  name: ENVELOPE_TOOL_NAME,
  description: 'Emit the synthesized SKILL.md envelope.',
  input_schema: {
    type: 'object',
    properties: {
      skillMd: { type: 'string' },
      marketplaceJson: { type: ['object', 'null'] },
      summary: { type: 'string' }
    },
    required: ['skillMd', 'summary']
  }
} as const satisfies Anthropic.Tool

/**
 * Run one per-skill synthesis: build the prompt, call the model with
 * `tool_choice` pinned to `emit_skill_envelope`, return the envelope
 * alongside the usage record. Errors bubble up unwrapped.
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
    model: input.model,
    tools: [ENVELOPE_TOOL],
    tool_choice: { type: 'tool', name: ENVELOPE_TOOL_NAME }
  })
  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock =>
      b.type === 'tool_use' && b.name === ENVELOPE_TOOL_NAME
  )
  if (toolUse !== undefined) {
    const e = toolUse.input as {
      skillMd: string
      marketplaceJson?: Record<string, unknown> | null
      summary: string
    }
    return {
      skillMd: e.skillMd,
      marketplaceJson: e.marketplaceJson ?? null,
      summary: e.summary,
      usage: response.usage
    }
  }
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

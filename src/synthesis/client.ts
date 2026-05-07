import Anthropic from '@anthropic-ai/sdk'
import type { BuiltPrompt } from './prompt.js'

/**
 * Per-call max_tokens. 8192 leaves headroom for a full SKILL.md + the
 * marketplace.json envelope; tighter than Opus 4.7's max but generous
 * enough that the model rarely needs to truncate.
 */
const DEFAULT_MAX_TOKENS = 8192

/**
 * Inputs needed to issue a single per-skill synthesis call.
 */
export interface ClientCallInput extends BuiltPrompt {
  /** Anthropic API key. Already registered via core.setSecret in PAI-124. */
  readonly apiKey: string
  /** Model ID — defaults to claude-opus-4-7 in the parser. */
  readonly model: string
}

/** Pass-through of the SDK's response shape. */
export type ClientCallResult = Anthropic.Messages.Message

/**
 * Issue one synthesis call against the Anthropic Messages API. SDK retries
 * are left at default (handles 529 / transient network errors); persistent
 * failures bubble up so the orchestrator (PAI-129) can mark the skill
 * failed without retrying for the full Action runner budget.
 */
export async function callClaude(
  input: ClientCallInput
): Promise<ClientCallResult> {
  const client = new Anthropic({ apiKey: input.apiKey })
  return client.messages.create({
    model: input.model,
    max_tokens: DEFAULT_MAX_TOKENS,
    system: input.system,
    messages: input.messages
  })
}

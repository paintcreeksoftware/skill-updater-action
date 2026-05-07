import type Anthropic from '@anthropic-ai/sdk'
import type { FetchedDocument } from '../sources/types.js'
import { SYSTEM_PROMPT } from './skillSpec.js'

/**
 * Subset of `messages.create` params that this module produces. Picking
 * only `system` + `messages` keeps the builder's contract tight — the
 * model/max_tokens/etc. are the client wrapper's concern.
 */
export type BuiltPrompt = Pick<
  Anthropic.Messages.MessageCreateParams,
  'system' | 'messages'
>

/**
 * Inputs the prompt builder needs to produce a per-skill synthesis call.
 */
export interface PromptInput {
  /** Existing SKILL.md content; pass `''` if there is no prior. */
  readonly priorSkillMd: string
  /**
   * Existing colocated `marketplace.json` content (raw JSON string), or
   * `undefined` if the skill has no marketplace metadata.
   */
  readonly priorMarketplaceJson?: string
  /** Documents the per-source fetchers returned for this skill. */
  readonly fetchedDocs: readonly FetchedDocument[]
}

const SYNTHESIS_INSTRUCTION = `Produce updated SKILL.md content based on the prior skill (if any) and
the fetched documents above. Apply every invariant in the system prompt —
especially the deprecation-preservation rule. Respond with the JSON
envelope as specified.`

/**
 * Build the `messages.create` parameters for one per-skill synthesis call.
 * Wires three `cache_control: { type: 'ephemeral' }` breakpoints
 * (system + prior block + fetched-docs block) so reruns and other skills
 * within the same run hit the prompt cache.
 */
export function buildPrompt(input: PromptInput): BuiltPrompt {
  return {
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: formatPriorBlock(
              input.priorSkillMd,
              input.priorMarketplaceJson
            ),
            cache_control: { type: 'ephemeral' }
          },
          {
            type: 'text',
            text: formatFetchedDocs(input.fetchedDocs),
            cache_control: { type: 'ephemeral' }
          },
          { type: 'text', text: SYNTHESIS_INSTRUCTION }
        ]
      }
    ]
  }
}

function formatPriorBlock(
  skillMd: string,
  marketplaceJson: string | undefined
): string {
  const skillBlock = `<prior-skill-md>\n${skillMd || '(no prior SKILL.md)'}\n</prior-skill-md>`
  if (marketplaceJson === undefined) return skillBlock
  return `${skillBlock}\n\n<prior-marketplace-json>\n${marketplaceJson}\n</prior-marketplace-json>`
}

function formatFetchedDocs(docs: readonly FetchedDocument[]): string {
  if (docs.length === 0) return '<fetched-documents/>'
  return docs
    .map(
      (d) =>
        `<doc src="${d.sourceUrl}" fetched-at="${d.fetchedAt.toISOString()}">\n${d.body}\n</doc>`
    )
    .join('\n\n')
}

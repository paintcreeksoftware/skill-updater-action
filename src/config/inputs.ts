import * as core from '@actions/core'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { SourceType } from './constants.js'

const WebSource = z.object({
  type: z.literal(SourceType.Web),
  url: z.url()
})

const GitSource = z.object({
  type: z.literal(SourceType.Git),
  url: z.url(),
  ref: z.string().min(1).optional(),
  paths: z.array(z.string().min(1)).min(1).optional()
})

const RssSource = z.object({
  type: z.literal(SourceType.Rss),
  url: z.url(),
  'max-items': z.number().int().positive().optional()
})

/**
 * A single upstream source entry in the `sources` input. Discriminated on
 * `type` so each branch enforces its own field set at runtime and via the
 * inferred TypeScript type.
 */
export const SourceSchema = z.discriminatedUnion('type', [
  WebSource,
  GitSource,
  RssSource
])

/**
 * The full `sources` input shape: a map of skill name → non-empty list of
 * sources to pull for that skill.
 */
export const SourcesMapSchema = z.record(
  z.string().min(1),
  z.array(SourceSchema).min(1)
)

export type Source = z.infer<typeof SourceSchema>
export type SourcesMap = z.infer<typeof SourcesMapSchema>

/**
 * Validated set of action inputs returned by {@link parseInputs}.
 */
export interface ParsedInputs {
  readonly sources: SourcesMap
  readonly anthropicApiKey: string
  readonly githubToken: string
  readonly model: string
  readonly branch: string
}

/**
 * Parse and validate every action input. Throws on any failure with a message
 * suitable for `core.setFailed` — the orchestrator (PAI-129) is responsible
 * for catching and surfacing.
 *
 * Side effects: registers `anthropic-api-key` and `github-token` with
 * {@link https://docs.github.com/en/actions/security-guides/encrypted-secrets#using-encrypted-secrets-in-a-workflow | core.setSecret}
 * so they cannot leak into action logs even on accidental `console.log`.
 *
 * @returns The parsed inputs, with TypeScript types derived from the same zod
 * schemas that did the runtime validation — no separate interface to keep in
 * sync.
 * @throws If any required input is missing, malformed, or a github-token is
 * the default `GITHUB_TOKEN` (see README on why that doesn't work).
 */
export function parseInputs(): ParsedInputs {
  const anthropicApiKey = core.getInput('anthropic-api-key', { required: true })
  core.setSecret(anthropicApiKey)

  const githubToken = core.getInput('github-token', { required: true })
  core.setSecret(githubToken)
  if (
    process.env.GITHUB_TOKEN !== undefined &&
    githubToken === process.env.GITHUB_TOKEN
  )
    throw new Error(
      "github-token input matches the default GITHUB_TOKEN. PRs opened with the default token don't trigger workflows on the target branch and auto-merge will block forever — use a fine-grained PAT or GitHub App installation token. See the README."
    )

  const sourcesYaml = core.getInput('sources', { required: true })
  let sourcesUnknown: unknown
  try {
    sourcesUnknown = parseYaml(sourcesYaml)
  } catch (err) {
    throw new Error(
      `sources input is not valid YAML: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err }
    )
  }
  const sourcesParsed = SourcesMapSchema.safeParse(sourcesUnknown)
  if (!sourcesParsed.success)
    throw new Error(
      `sources input failed schema validation:\n${sourcesParsed.error.issues
        .map((i) => `  - ${i.path.join('.') || '<root>'}: ${i.message}`)
        .join('\n')}`
    )

  const model = core.getInput('model') || 'claude-opus-4-7'
  const branch = core.getInput('branch') || 'skill-updater/auto'

  return {
    sources: sourcesParsed.data,
    anthropicApiKey,
    githubToken,
    model,
    branch
  }
}

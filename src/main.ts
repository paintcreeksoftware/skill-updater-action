import * as core from '@actions/core'
import { context } from '@actions/github'
import type { Anthropic } from '@anthropic-ai/sdk'
import { readFile } from 'node:fs/promises'
import { parseInputs } from './config/inputs.js'
import { discoverSkills, type DiscoveredSkill } from './discovery/skills.js'
import { resetRollingBranch } from './git/branch.js'
import { commitChanges, pushBranch } from './git/commit.js'
import { ensurePullRequest, tryEnableAutoMerge } from './git/pr.js'
import { findRepoRoot } from './git/workspace.js'
import { writeSkill, type WriteResult } from './output/writer.js'
import { fetchSource } from './sources/fetcher.js'
import { estimateCost, sumUsage } from './synthesis/pricing.js'
import { synthesize, type SynthesisResult } from './synthesis/synthesize.js'
import { formatError } from './util/logger.js'

interface PerSkillRun {
  readonly skillName: string
  readonly skill: DiscoveredSkill
  readonly result: SynthesisResult
  readonly write: WriteResult
}

/** Action entry point. PAI-129 wires the pipeline incrementally. */
export async function run(): Promise<void> {
  try {
    const inputs = parseInputs()
    const repoRoot = await findRepoRoot()
    const discovered = await discoverSkills(repoRoot)
    const byName = new Map(discovered.map((s) => [s.name, s]))

    const missing = Object.keys(inputs.sources).filter((n) => !byName.has(n))
    if (missing.length > 0) {
      core.setFailed(
        `sources references skill name(s) not found in repo: ${missing.join(', ')}. Discovered: ${discovered.map((s) => s.name).join(', ') || '(none)'}`
      )
      return
    }

    const runs: PerSkillRun[] = []
    for (const [skillName, sourceList] of Object.entries(inputs.sources)) {
      const skill = byName.get(skillName)!
      const fetched = (await Promise.all(sourceList.map(fetchSource))).flat()
      const prior = await readPriorContent(skill)
      const result = await synthesize({
        ...prior,
        fetchedDocs: fetched,
        apiKey: inputs.anthropicApiKey,
        model: inputs.model
      })
      const write = await writeSkill(skill, result)
      runs.push({ skillName, skill, result, write })
    }

    const changedRuns = runs.filter((r) => r.write.changed)
    if (changedRuns.length === 0) {
      core.info('All skills already up to date — no changes to publish.')
      core.setOutput('pr-url', '')
      return
    }

    const base = defaultBranch()
    const message = 'chore(skill): refresh skills from upstream sources'
    const body = formatPrBody(changedRuns, inputs.model)
    const allFiles = changedRuns.flatMap((r) => r.write.changedFiles)

    await resetRollingBranch(inputs.branch, base, repoRoot)
    await commitChanges({ cwd: repoRoot, files: allFiles, message })
    await pushBranch(inputs.branch, repoRoot)
    const pr = await ensurePullRequest({
      token: inputs.githubToken,
      branch: inputs.branch,
      base,
      title: message,
      body
    })
    await tryEnableAutoMerge(inputs.githubToken, pr.nodeId)

    core.setOutput('pr-url', pr.url)
  } catch (err) {
    core.setFailed(formatError('skill-updater-action failed', err))
  }
}

function defaultBranch(): string {
  return (
    (context.payload.repository as { default_branch?: string } | undefined)
      ?.default_branch ?? 'main'
  )
}

const ZERO_USAGE: Anthropic.Usage = {
  cache_creation: null,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  inference_geo: null,
  input_tokens: 0,
  output_tokens: 0,
  server_tool_use: null,
  service_tier: 'standard'
}

function formatPrBody(runs: readonly PerSkillRun[], model: string): string {
  const sections = runs
    .map((r) => `### ${r.skillName}\n\n${r.result.summary}\n`)
    .join('\n')
  const total = runs.reduce(
    (acc, r) => sumUsage(acc, r.result.usage),
    ZERO_USAGE
  )
  const cost = estimateCost(model, total)
  const costLine =
    cost === undefined
      ? `Token usage: in ${total.input_tokens} / cache+ ${total.cache_creation_input_tokens ?? 0} / cache- ${total.cache_read_input_tokens ?? 0} / out ${total.output_tokens}. Cost not computed (unknown model: ${model}).`
      : `Estimated cost (${model}): $${cost.toFixed(4)}. Tokens: in ${total.input_tokens} / cache+ ${total.cache_creation_input_tokens ?? 0} / cache- ${total.cache_read_input_tokens ?? 0} / out ${total.output_tokens}.`
  return `${sections}\n## Cost summary\n\n${costLine}\n`
}

async function readPriorContent(
  skill: DiscoveredSkill
): Promise<{ priorSkillMd: string; priorMarketplaceJson?: string }> {
  let priorSkillMd = ''
  try {
    priorSkillMd = await readFile(skill.skillMdPath, 'utf8')
  } catch {
    /* missing SKILL.md is fine for a soon-to-be bootstrap path */
  }
  if (skill.marketplaceJsonPath === undefined) return { priorSkillMd }
  const priorMarketplaceJson = await readFile(skill.marketplaceJsonPath, 'utf8')
  return { priorSkillMd, priorMarketplaceJson }
}

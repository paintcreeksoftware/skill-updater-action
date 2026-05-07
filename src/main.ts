import * as core from '@actions/core'
import { readFile } from 'node:fs/promises'
import { parseInputs } from './config/inputs.js'
import { discoverSkills, type DiscoveredSkill } from './discovery/skills.js'
import { findRepoRoot } from './git/workspace.js'
import { writeSkill, type WriteResult } from './output/writer.js'
import { fetchSource } from './sources/fetcher.js'
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

    core.setFailed(
      'skill-updater-action: PR pipeline not yet wired (PAI-129 in progress).'
    )
  } catch (err) {
    core.setFailed(formatError('skill-updater-action failed', err))
  }
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

import * as core from '@actions/core'
import { parseInputs } from './config/inputs.js'
import { discoverSkills } from './discovery/skills.js'
import { findRepoRoot } from './git/workspace.js'
import { formatError } from './util/logger.js'

/**
 * Action entry point. PAI-129 lands the full pipeline incrementally:
 *
 * - this commit: parseInputs + discoverSkills + the cross-check that
 *   every name in `sources` matches a discovered skill (fail-fast,
 *   zero token spend)
 * - next commit: per-skill fetch + synthesize + write loop
 * - last commit: branch + commit + push + PR + best-effort auto-merge,
 *   plus the cost-summary PR body and the no-op exit short-circuit
 */
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

    core.setFailed(
      'skill-updater-action: pipeline not yet wired (PAI-129 in progress).'
    )
  } catch (err) {
    core.setFailed(formatError('skill-updater-action failed', err))
  }
}

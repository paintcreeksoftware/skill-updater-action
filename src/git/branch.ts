import { exec } from '@actions/exec'

/**
 * Reset the rolling PR branch to base on every run. Pulls the latest
 * `base` from origin and force-creates `branch` on top so the PR diff
 * stays "current state vs. base" rather than drifting across runs.
 *
 * The orchestrator (PAI-129) calls this once after deciding any skill
 * changed; per-skill writes happen on the resulting working tree, then
 * `commit.ts` stages + commits and a separate push step does the
 * `--force-with-lease`.
 *
 * @param branch - Rolling branch name (default `skill-updater/auto`).
 * @param base - Base branch to reset against (defaults to the repo's
 * default branch in the orchestrator).
 * @param cwd - Repo root, from {@link findRepoRoot}.
 */
export async function resetRollingBranch(
  branch: string,
  base: string,
  cwd: string
): Promise<void> {
  await exec('git', ['fetch', 'origin', base], { cwd })
  await exec('git', ['checkout', '-B', branch, `origin/${base}`], { cwd })
}

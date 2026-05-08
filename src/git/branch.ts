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
  // Best-effort fetch of the rolling branch so commit.ts's
  // `git push --force-with-lease` has an accurate remote-tracking ref to
  // compare against. On the first run the branch doesn't exist remotely
  // yet — that fetch fails non-zero and we proceed; on subsequent runs
  // the fetch populates refs/remotes/origin/<branch> and the lease
  // check succeeds instead of rejecting our own push as "stale info."
  await exec('git', ['fetch', 'origin', branch], {
    cwd,
    ignoreReturnCode: true
  })
  await exec('git', ['checkout', '-B', branch, `origin/${base}`], { cwd })
}

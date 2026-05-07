import { exec } from '@actions/exec'

const BOT_NAME = 'github-actions[bot]'
const BOT_EMAIL = '41898282+github-actions[bot]@users.noreply.github.com'

export interface CommitInput {
  readonly cwd: string
  readonly files: readonly string[]
  readonly message: string
}

/**
 * Stage `files` and commit them with `github-actions[bot]` as both author
 * and committer (set inline via `-c user.name=... -c user.email=...` so we
 * don't write to the runner's git config). The orchestrator (PAI-129)
 * passes the WriteResult.changedFiles aggregated across skills.
 */
export async function commitChanges({
  cwd,
  files,
  message
}: CommitInput): Promise<void> {
  await exec('git', ['add', '--', ...files], { cwd })
  await exec(
    'git',
    [
      '-c',
      `user.name=${BOT_NAME}`,
      '-c',
      `user.email=${BOT_EMAIL}`,
      'commit',
      '-m',
      message
    ],
    { cwd }
  )
}

/**
 * Force-push `branch` to origin via `--force-with-lease`. Pairs with
 * `resetRollingBranch` — between them, the rolling branch's tip after
 * each run is exactly the commit just made.
 */
export async function pushBranch(branch: string, cwd: string): Promise<void> {
  await exec('git', ['push', '--force-with-lease', 'origin', branch], { cwd })
}

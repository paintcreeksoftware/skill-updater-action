import { getExecOutput } from '@actions/exec'

/**
 * Resolve the consumer repo's working-tree root via `git rev-parse
 * --show-toplevel`. Used by the orchestrator (PAI-129) as the cwd for
 * skill discovery (so glob paths land in the right tree) and for the
 * branch / commit operations.
 *
 * @throws If git isn't on PATH or the action's checkout step didn't run.
 */
export async function findRepoRoot(): Promise<string> {
  const result = await getExecOutput('git', ['rev-parse', '--show-toplevel'], {
    silent: true
  })
  return result.stdout.trim()
}

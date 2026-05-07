import * as core from '@actions/core'
import { parseInputs } from './config/inputs.js'

/**
 * Action entry point.
 *
 * Currently runs only the input-parsing pass and then deliberately fails
 * with a "not implemented" message — the rest of the pipeline (discovery,
 * fetchers, synthesis, writer, PR flow) lands across the remaining sub-issues
 * of [PAI-122](https://linear.app/paint-creek-software/issue/PAI-122).
 *
 * Wiring `parseInputs()` here lets users with a real workflow exercise the
 * input schema end-to-end (and see the parser's error messages in their
 * Action log) before the rest of the chain merges. Bad inputs surface as the
 * parser's specific error; good inputs surface as the not-implemented
 * sentinel.
 *
 * @returns Resolves once the action completes (always; failure is reported
 * via `core.setFailed`, not by throwing).
 */
export async function run(): Promise<void> {
  try {
    parseInputs()
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err))
    return
  }
  core.setFailed(
    'skill-updater-action: not implemented yet. Track progress at https://linear.app/paint-creek-software/issue/PAI-122.'
  )
}

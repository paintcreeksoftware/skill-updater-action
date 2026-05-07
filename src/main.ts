import * as core from '@actions/core'

/**
 * Action entry point.
 *
 * This is a stub. The real implementation lands incrementally across the
 * remaining sub-issues of [PAI-122](https://linear.app/paint-creek-software/issue/PAI-122):
 * PAI-124 wires the input schema and coverage gate, PAI-125 adds skill
 * discovery, PAI-126/127 add the source fetchers, PAI-128 adds Claude
 * synthesis, and PAI-129 wires the orchestrator + PR flow.
 *
 * Running the action before that chain merges fails fast with an explicit
 * "not implemented" message rather than appearing to succeed silently.
 *
 * @returns Resolves once the action completes (always; failure is reported
 * via `core.setFailed`, not by throwing).
 */
export async function run(): Promise<void> {
  core.setFailed(
    'skill-updater-action: not implemented yet. Track progress at https://linear.app/paint-creek-software/issue/PAI-122.'
  )
}

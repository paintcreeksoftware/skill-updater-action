/**
 * Tests for src/main.ts orchestrator scaffolding (PAI-129 step 1):
 * parseInputs + discoverSkills + cross-check.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'
import type { ParsedInputs } from '../src/config/inputs.js'
import type { DiscoveredSkill } from '../src/discovery/skills.js'

const parseInputs = jest.fn<() => ParsedInputs>()
const discoverSkills = jest.fn<(root: string) => Promise<DiscoveredSkill[]>>()
const findRepoRoot = jest.fn<() => Promise<string>>()

jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('../src/config/inputs.js', () => ({ parseInputs }))
jest.unstable_mockModule('../src/discovery/skills.js', () => ({
  discoverSkills
}))
jest.unstable_mockModule('../src/git/workspace.js', () => ({ findRepoRoot }))

const { run } = await import('../src/main.js')

const validInputs: ParsedInputs = {
  sources: { foo: [{ type: 'web', url: 'https://x' }] },
  anthropicApiKey: 'sk',
  githubToken: 'gh',
  model: 'claude-opus-4-7',
  branch: 'skill-updater/auto'
}

beforeEach(() => {
  jest.resetAllMocks()
  findRepoRoot.mockResolvedValue('/repo')
})

describe('main.ts (orchestrator scaffolding)', () => {
  it('fails the run when sources references an undiscovered skill', async () => {
    parseInputs.mockReturnValue(validInputs)
    discoverSkills.mockResolvedValue([])

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining(
        'sources references skill name(s) not found in repo: foo'
      )
    )
  })

  it('falls through to the pipeline-stub failure once cross-check passes', async () => {
    parseInputs.mockReturnValue(validInputs)
    discoverSkills.mockResolvedValue([
      { name: 'foo', dir: '/repo', skillMdPath: '/repo/SKILL.md' }
    ])

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('pipeline not yet wired')
    )
  })
})

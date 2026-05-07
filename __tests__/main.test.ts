/** Tests for src/main.ts orchestrator (parser/discovery/cross-check + per-skill loop). */
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'
import type { ParsedInputs } from '../src/config/inputs.js'
import type { DiscoveredSkill } from '../src/discovery/skills.js'
import type { fetchSource as FetchSource } from '../src/sources/fetcher.js'
import type { synthesize as Synthesize } from '../src/synthesis/synthesize.js'
import type { writeSkill as WriteSkill } from '../src/output/writer.js'
import type { resetRollingBranch as ResetBranch } from '../src/git/branch.js'
import type {
  commitChanges as CommitChanges,
  pushBranch as PushBranch
} from '../src/git/commit.js'
import type {
  ensurePullRequest as EnsurePr,
  tryEnableAutoMerge as TryAutoMerge
} from '../src/git/pr.js'

const parseInputs = jest.fn<() => ParsedInputs>()
const discoverSkills = jest.fn<(root: string) => Promise<DiscoveredSkill[]>>()
const findRepoRoot = jest.fn<() => Promise<string>>()
const fetchSource = jest.fn<typeof FetchSource>()
const synthesize = jest.fn<typeof Synthesize>()
const writeSkill = jest.fn<typeof WriteSkill>()
const readFile = jest.fn<(path: string, enc?: string) => Promise<string>>()
const resetRollingBranch = jest.fn<typeof ResetBranch>()
const commitChanges = jest.fn<typeof CommitChanges>()
const pushBranch = jest.fn<typeof PushBranch>()
const ensurePullRequest = jest.fn<typeof EnsurePr>()
const tryEnableAutoMerge = jest.fn<typeof TryAutoMerge>()

jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('../src/config/inputs.js', () => ({ parseInputs }))
jest.unstable_mockModule('../src/discovery/skills.js', () => ({
  discoverSkills
}))
jest.unstable_mockModule('../src/git/workspace.js', () => ({ findRepoRoot }))
jest.unstable_mockModule('../src/sources/fetcher.js', () => ({ fetchSource }))
jest.unstable_mockModule('../src/synthesis/synthesize.js', () => ({
  synthesize
}))
jest.unstable_mockModule('../src/output/writer.js', () => ({ writeSkill }))
jest.unstable_mockModule('node:fs/promises', () => ({ readFile }))
jest.unstable_mockModule('../src/git/branch.js', () => ({ resetRollingBranch }))
jest.unstable_mockModule('../src/git/commit.js', () => ({
  commitChanges,
  pushBranch
}))
jest.unstable_mockModule('../src/git/pr.js', () => ({
  ensurePullRequest,
  tryEnableAutoMerge
}))
jest.unstable_mockModule('@actions/github', () => ({
  context: { payload: { repository: { default_branch: 'main' } } }
}))

const { run } = await import('../src/main.js')

const skill: DiscoveredSkill = {
  name: 'foo',
  dir: '/repo',
  skillMdPath: '/repo/SKILL.md'
}
const inputs: ParsedInputs = {
  sources: { foo: [{ type: 'web', url: 'https://x' }] },
  anthropicApiKey: 'sk',
  githubToken: 'gh',
  model: 'claude-opus-4-7',
  branch: 'skill-updater/auto'
}
const synthResult = {
  skillMd: '# new',
  marketplaceJson: null,
  summary: 'fresh',
  usage: {
    input_tokens: 1,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    output_tokens: 1,
    service_tier: 'standard'
  }
}

beforeEach(() => {
  jest.resetAllMocks()
  findRepoRoot.mockResolvedValue('/repo')
  readFile.mockResolvedValue('# old')
  fetchSource.mockResolvedValue([])
  synthesize.mockResolvedValue(synthResult)
})

describe('main.ts (orchestrator)', () => {
  it('fails the run when sources references an undiscovered skill', async () => {
    parseInputs.mockReturnValue(inputs)
    discoverSkills.mockResolvedValue([])
    await run()
    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining(
        'sources references skill name(s) not found in repo: foo'
      )
    )
  })

  it('no-op exits when no skill changed', async () => {
    parseInputs.mockReturnValue(inputs)
    discoverSkills.mockResolvedValue([skill])
    writeSkill.mockResolvedValue({ changed: false, changedFiles: [] })
    await run()
    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining('All skills already up to date')
    )
    expect(core.setOutput).toHaveBeenCalledWith('pr-url', '')
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('runs the full PR pipeline and sets pr-url when at least one skill changed', async () => {
    parseInputs.mockReturnValue(inputs)
    discoverSkills.mockResolvedValue([skill])
    writeSkill.mockResolvedValue({
      changed: true,
      changedFiles: ['/repo/SKILL.md']
    })
    ensurePullRequest.mockResolvedValue({
      url: 'https://gh/pr/9',
      number: 9,
      nodeId: 'PR_9'
    })
    await run()
    expect(resetRollingBranch).toHaveBeenCalledWith(
      'skill-updater/auto',
      'main',
      '/repo'
    )
    expect(commitChanges).toHaveBeenCalledWith({
      cwd: '/repo',
      files: ['/repo/SKILL.md'],
      message: 'chore(skill): refresh skills from upstream sources'
    })
    expect(pushBranch).toHaveBeenCalledWith('skill-updater/auto', '/repo')
    expect(tryEnableAutoMerge).toHaveBeenCalledWith('gh', 'PR_9')
    expect(core.setOutput).toHaveBeenCalledWith('pr-url', 'https://gh/pr/9')
    expect(core.setFailed).not.toHaveBeenCalled()
  })
})

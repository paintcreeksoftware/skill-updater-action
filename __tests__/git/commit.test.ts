import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import type { exec as Exec } from '@actions/exec'

const exec = jest.fn<typeof Exec>()
jest.unstable_mockModule('@actions/exec', () => ({ exec }))

const { commitChanges, pushBranch } = await import('../../src/git/commit.js')

beforeEach(() => {
  jest.resetAllMocks()
})

describe('commitChanges', () => {
  it('stages files via `git add --` then commits with bot author + committer', async () => {
    exec.mockResolvedValue(0)

    await commitChanges({
      cwd: '/repo',
      files: ['SKILL.md', 'marketplace.json'],
      message: 'chore(skill): refresh'
    })

    expect(exec).toHaveBeenNthCalledWith(
      1,
      'git',
      ['add', '--', 'SKILL.md', 'marketplace.json'],
      { cwd: '/repo' }
    )
    const commitCall = exec.mock.calls[1]
    expect(commitCall[0]).toBe('git')
    expect(commitCall[1]).toContain('-c')
    expect(commitCall[1]).toContain('user.name=github-actions[bot]')
    expect(commitCall[1]).toContain('commit')
    expect(commitCall[1]).toContain('chore(skill): refresh')
  })
})

describe('pushBranch', () => {
  it('force-with-leases the branch to origin', async () => {
    exec.mockResolvedValue(0)
    await pushBranch('skill-updater/auto', '/repo')
    expect(exec).toHaveBeenCalledWith(
      'git',
      ['push', '--force-with-lease', 'origin', 'skill-updater/auto'],
      { cwd: '/repo' }
    )
  })
})

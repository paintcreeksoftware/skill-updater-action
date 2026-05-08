import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import type { exec as Exec } from '@actions/exec'

const exec = jest.fn<typeof Exec>()
jest.unstable_mockModule('@actions/exec', () => ({ exec }))

const { resetRollingBranch } = await import('../../src/git/branch.js')

beforeEach(() => {
  jest.resetAllMocks()
})

describe('resetRollingBranch', () => {
  it('fetches base, fetches rolling branch (best-effort), then checkout -B', async () => {
    exec.mockResolvedValue(0)

    await resetRollingBranch('skill-updater/auto', 'main', '/repo')

    expect(exec).toHaveBeenNthCalledWith(
      1,
      'git',
      ['fetch', 'origin', 'main'],
      { cwd: '/repo' }
    )
    expect(exec).toHaveBeenNthCalledWith(
      2,
      'git',
      ['fetch', 'origin', 'skill-updater/auto'],
      { cwd: '/repo', ignoreReturnCode: true }
    )
    expect(exec).toHaveBeenNthCalledWith(
      3,
      'git',
      ['checkout', '-B', 'skill-updater/auto', 'origin/main'],
      { cwd: '/repo' }
    )
  })

  // Regression: on the first run the rolling branch doesn't exist
  // remotely yet, so `git fetch origin <branch>` exits non-zero. The
  // action must not abort — it must proceed to the checkout so the
  // first run can create the branch locally and push it.
  it('tolerates missing remote rolling branch on first run (fetch returns non-zero)', async () => {
    exec.mockResolvedValueOnce(0) // base fetch
    exec.mockResolvedValueOnce(1) // rolling-branch fetch: not found
    exec.mockResolvedValueOnce(0) // checkout

    await expect(
      resetRollingBranch('skill-updater/auto', 'main', '/repo')
    ).resolves.toBeUndefined()

    expect(exec).toHaveBeenCalledTimes(3)
    expect(exec).toHaveBeenNthCalledWith(
      3,
      'git',
      ['checkout', '-B', 'skill-updater/auto', 'origin/main'],
      { cwd: '/repo' }
    )
  })

  it('rethrows when the base fetch fails (e.g. no network)', async () => {
    exec.mockRejectedValueOnce(new Error('Could not resolve host'))
    await expect(resetRollingBranch('b', 'main', '/repo')).rejects.toThrow(
      /Could not resolve host/
    )
  })
})

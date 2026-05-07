import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import type { exec as Exec } from '@actions/exec'

const exec = jest.fn<typeof Exec>()
jest.unstable_mockModule('@actions/exec', () => ({ exec }))

const { resetRollingBranch } = await import('../../src/git/branch.js')

beforeEach(() => {
  jest.resetAllMocks()
})

describe('resetRollingBranch', () => {
  it('fetches the base then checkout -B forces the rolling branch onto it', async () => {
    exec.mockResolvedValue(0)

    await resetRollingBranch('skill-updater/auto', 'main', '/repo')

    expect(exec).toHaveBeenNthCalledWith(
      1,
      'git',
      ['fetch', 'origin', 'main'],
      {
        cwd: '/repo'
      }
    )
    expect(exec).toHaveBeenNthCalledWith(
      2,
      'git',
      ['checkout', '-B', 'skill-updater/auto', 'origin/main'],
      { cwd: '/repo' }
    )
  })

  it('rethrows when git fetch fails (e.g. no network)', async () => {
    exec.mockRejectedValueOnce(new Error('Could not resolve host'))
    await expect(resetRollingBranch('b', 'main', '/repo')).rejects.toThrow(
      /Could not resolve host/
    )
  })
})

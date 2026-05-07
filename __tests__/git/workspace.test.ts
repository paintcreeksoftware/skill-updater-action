import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import type { getExecOutput as GetExecOutput } from '@actions/exec'

const getExecOutput = jest.fn<typeof GetExecOutput>()
jest.unstable_mockModule('@actions/exec', () => ({ getExecOutput }))

const { findRepoRoot } = await import('../../src/git/workspace.js')

beforeEach(() => {
  jest.resetAllMocks()
})

describe('findRepoRoot', () => {
  it('runs `git rev-parse --show-toplevel` silently and trims the result', async () => {
    getExecOutput.mockResolvedValueOnce({
      stdout: '/workspaces/some-repo\n',
      stderr: '',
      exitCode: 0
    })
    const root = await findRepoRoot()
    expect(getExecOutput).toHaveBeenCalledWith(
      'git',
      ['rev-parse', '--show-toplevel'],
      { silent: true }
    )
    expect(root).toBe('/workspaces/some-repo')
  })

  it('rethrows when git is not on PATH', async () => {
    getExecOutput.mockRejectedValueOnce(new Error('git: command not found'))
    await expect(findRepoRoot()).rejects.toThrow(/command not found/)
  })
})

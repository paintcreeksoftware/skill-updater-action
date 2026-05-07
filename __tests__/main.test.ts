/**
 * Unit tests for src/main.ts.
 *
 * The action body is currently a `core.setFailed` stub (see PAI-123). These
 * tests assert that the stub fails the workflow with the expected message;
 * they will be expanded as PAI-124 onward fills in the real behavior.
 *
 * Mocks follow the project pattern: declare with `jest.unstable_mockModule`
 * before the dynamic import of the module under test so the mock takes effect.
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

jest.unstable_mockModule('@actions/core', () => core)

const { run } = await import('../src/main.js')

describe('main.ts', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('fails the workflow with a not-implemented message pointing at the epic', async () => {
    await run()

    expect(core.setFailed).toHaveBeenCalledTimes(1)
    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('skill-updater-action: not implemented yet')
    )
    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('PAI-122')
    )
  })
})

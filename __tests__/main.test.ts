/**
 * Unit tests for src/main.ts.
 *
 * `parseInputs` is mocked so these tests stay focused on main.ts's two
 * branches — parser-error path vs. happy-path-then-not-implemented — without
 * exercising the real schema validation (covered separately in
 * __tests__/config/inputs.test.ts).
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

const parseInputs = jest.fn<() => void>()

jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('../src/config/inputs.js', () => ({ parseInputs }))

const { run } = await import('../src/main.js')

describe('main.ts', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('forwards parser errors to setFailed and stops', async () => {
    parseInputs.mockImplementation(() => {
      throw new Error('sources input failed schema validation: bad type')
    })

    await run()

    expect(core.setFailed).toHaveBeenCalledTimes(1)
    expect(core.setFailed).toHaveBeenCalledWith(
      'sources input failed schema validation: bad type'
    )
  })

  it('coerces non-Error throws to string before forwarding to setFailed', async () => {
    parseInputs.mockImplementation(() => {
      throw 'string thrown directly'
    })

    await run()

    expect(core.setFailed).toHaveBeenCalledWith('string thrown directly')
  })

  it('reports the not-implemented sentinel when parsing succeeds', async () => {
    parseInputs.mockImplementation(() => {
      // happy path — parseInputs is silent on success
    })

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

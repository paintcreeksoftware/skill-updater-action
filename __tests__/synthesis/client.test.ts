/** Mocks @anthropic-ai/sdk's default export to assert call params propagate. */
import { describe, it, expect, beforeEach, jest } from '@jest/globals'

const create = jest.fn<(...args: unknown[]) => Promise<unknown>>()
class MockAnthropic {
  static lastCtorArgs: unknown[] = []
  constructor(...args: unknown[]) {
    MockAnthropic.lastCtorArgs = args
  }
  messages = { create }
}

jest.unstable_mockModule('@anthropic-ai/sdk', () => ({
  default: MockAnthropic
}))

const { callClaude } = await import('../../src/synthesis/client.js')

beforeEach(() => {
  jest.resetAllMocks()
  MockAnthropic.lastCtorArgs = []
})

describe('callClaude', () => {
  it('forwards model, system, messages, and max_tokens to messages.create', async () => {
    create.mockResolvedValueOnce({ stub: true })

    const out = await callClaude({
      apiKey: 'sk-ant-test',
      model: 'claude-opus-4-7',
      system: [{ type: 'text', text: 'sys' }],
      messages: [{ role: 'user', content: [{ type: 'text', text: 'u' }] }]
    })

    expect(MockAnthropic.lastCtorArgs[0]).toEqual({ apiKey: 'sk-ant-test' })
    expect(create).toHaveBeenCalledWith({
      model: 'claude-opus-4-7',
      max_tokens: 8192,
      system: [{ type: 'text', text: 'sys' }],
      messages: [{ role: 'user', content: [{ type: 'text', text: 'u' }] }]
    })
    expect(out).toEqual({ stub: true })
  })

  it('rethrows SDK errors unwrapped (the orchestrator decides what to do)', async () => {
    create.mockRejectedValueOnce(new Error('429 rate limited'))

    await expect(
      callClaude({
        apiKey: 'sk-ant-test',
        model: 'claude-opus-4-7',
        system: [],
        messages: []
      })
    ).rejects.toThrow(/429 rate limited/)
  })
})

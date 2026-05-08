/** Tests for synthesize.ts orchestrator. callClaude is mocked at the module boundary. */
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import type { callClaude as CallClaude } from '../../src/synthesis/client.js'

const callClaude = jest.fn<typeof CallClaude>()
jest.unstable_mockModule('../../src/synthesis/client.js', () => ({
  callClaude
}))

const { synthesize } = await import('../../src/synthesis/synthesize.js')

const usage = {
  input_tokens: 100,
  cache_creation_input_tokens: 1000,
  cache_read_input_tokens: 0,
  output_tokens: 50,
  service_tier: 'standard'
}

const baseInput = {
  apiKey: 'sk-ant-test',
  model: 'claude-opus-4-7',
  priorSkillMd: '# old',
  fetchedDocs: []
}

beforeEach(() => {
  jest.resetAllMocks()
})

describe('synthesize (happy path)', () => {
  it('parses a fenced JSON envelope and returns it with usage', async () => {
    callClaude.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '```json\n{"skillMd":"# new","marketplaceJson":{"version":"1.0.1"},"summary":"bumped"}\n```'
        }
      ],
      usage
    } as unknown as Awaited<ReturnType<typeof CallClaude>>)

    const result = await synthesize(baseInput)

    expect(result.skillMd).toBe('# new')
    expect(result.marketplaceJson).toEqual({ version: '1.0.1' })
    expect(result.summary).toBe('bumped')
    expect(result.usage).toEqual(usage)
  })

  it('parses an unfenced JSON envelope', async () => {
    callClaude.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '{"skillMd":"# bare","marketplaceJson":null,"summary":"ok"}'
        }
      ],
      usage
    } as unknown as Awaited<ReturnType<typeof CallClaude>>)

    const result = await synthesize(baseInput)
    expect(result.skillMd).toBe('# bare')
    expect(result.marketplaceJson).toBeNull()
  })

  it('reads emit_skill_envelope tool_use block when present', async () => {
    callClaude.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'toolu_test',
          name: 'emit_skill_envelope',
          input: { skillMd: '# tool', summary: 'via tool_use' }
        }
      ],
      usage
    } as unknown as Awaited<ReturnType<typeof CallClaude>>)

    const result = await synthesize(baseInput)
    expect(result.skillMd).toBe('# tool')
    expect(result.marketplaceJson).toBeNull()
    expect(result.summary).toBe('via tool_use')
  })
})

describe('synthesize (failure modes)', () => {
  it('throws on empty response content', async () => {
    callClaude.mockResolvedValueOnce({
      content: [],
      usage
    } as unknown as Awaited<ReturnType<typeof CallClaude>>)
    await expect(synthesize(baseInput)).rejects.toThrow(/response was empty/)
  })

  it('throws on malformed JSON in the envelope', async () => {
    callClaude.mockResolvedValueOnce({
      content: [{ type: 'text', text: '```json\nnot { valid json\n```' }],
      usage
    } as unknown as Awaited<ReturnType<typeof CallClaude>>)
    await expect(synthesize(baseInput)).rejects.toThrow(/not valid JSON/)
  })

  it('throws when envelope is missing required skillMd / summary fields', async () => {
    callClaude.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"summary": "no skillMd here"}' }],
      usage
    } as unknown as Awaited<ReturnType<typeof CallClaude>>)
    await expect(synthesize(baseInput)).rejects.toThrow(
      /missing required fields/
    )
  })

  it('rethrows SDK errors (e.g. retry exhaustion) unwrapped', async () => {
    callClaude.mockRejectedValueOnce(new Error('429 retries exhausted'))
    await expect(synthesize(baseInput)).rejects.toThrow(/429 retries exhausted/)
  })
})

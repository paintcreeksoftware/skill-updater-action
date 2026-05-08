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
  it('reads the emit_skill_envelope tool_use block and returns it with usage', async () => {
    callClaude.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'toolu_test',
          name: 'emit_skill_envelope',
          input: {
            skillMd: '# new',
            marketplaceJson: { version: '1.0.1' },
            summary: 'bumped'
          }
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

  it('coerces a missing marketplaceJson on the tool input to null', async () => {
    callClaude.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'toolu_test',
          name: 'emit_skill_envelope',
          input: { skillMd: '# bare', summary: 'ok' }
        }
      ],
      usage
    } as unknown as Awaited<ReturnType<typeof CallClaude>>)

    const result = await synthesize(baseInput)
    expect(result.marketplaceJson).toBeNull()
  })

  // Regression: v0.1.0 asked the model for a fenced-JSON envelope and
  // regex-stripped the response. When skillMd contained ```ts``` (or any
  // other) fences, the permissive regex captured the inner fence as the
  // JSON body and JSON.parse failed on `Unexpected token 's', "ts\nexport "...`.
  // Routing the envelope through tool_use makes this structurally
  // impossible: skillMd is a string field on a typed `input` object and
  // never round-trips through text. This test pins that property — if
  // anyone reintroduces text parsing in synthesize(), it fires.
  it('preserves nested code fences inside skillMd verbatim (regression: v0.1.0 nested-fence parse failure)', async () => {
    const skillMdWithFences = [
      '# Lint Skill',
      '',
      '## Example',
      '',
      '```ts',
      "export const x: string = 'hello'",
      'export function y(): void { return }',
      '```',
      '',
      '## Config',
      '',
      '```json',
      '{ "extends": ["@org/eslint-config"] }',
      '```',
      ''
    ].join('\n')

    callClaude.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'toolu_test',
          name: 'emit_skill_envelope',
          input: { skillMd: skillMdWithFences, summary: 'fences ok' }
        }
      ],
      usage
    } as unknown as Awaited<ReturnType<typeof CallClaude>>)

    const result = await synthesize(baseInput)
    expect(result.skillMd).toBe(skillMdWithFences)
    expect(result.summary).toBe('fences ok')
  })
})

describe('synthesize (failure modes)', () => {
  it('throws when no emit_skill_envelope tool_use block is present', async () => {
    callClaude.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'i forgot the tool' }],
      usage
    } as unknown as Awaited<ReturnType<typeof CallClaude>>)
    await expect(synthesize(baseInput)).rejects.toThrow(
      /missing emit_skill_envelope tool_use block/
    )
  })

  it('rethrows SDK errors (e.g. retry exhaustion) unwrapped', async () => {
    callClaude.mockRejectedValueOnce(new Error('429 retries exhausted'))
    await expect(synthesize(baseInput)).rejects.toThrow(/429 retries exhausted/)
  })
})

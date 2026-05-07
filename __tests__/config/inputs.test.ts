/**
 * Unit tests for src/config/inputs.ts.
 */
import { jest } from '@jest/globals'
import * as core from '../../__fixtures__/core.js'

jest.unstable_mockModule('@actions/core', () => core)

const { parseInputs } = await import('../../src/config/inputs.js')

interface MockInputs {
  readonly 'anthropic-api-key'?: string
  readonly 'github-token'?: string
  readonly sources?: string
  readonly model?: string
  readonly branch?: string
}

function withInputs(values: MockInputs): void {
  core.getInput.mockImplementation(((
    name: string,
    options?: { required?: boolean }
  ): string => {
    const v = values[name as keyof MockInputs]
    if (v === undefined) {
      if (options?.required)
        throw new Error(`Input required and not supplied: ${name}`)
      return ''
    }
    return v
  }) as typeof core.getInput)
}

const validSources = `
my-skill:
  - type: web
    url: https://example.com/docs
`.trim()

const baseValid: MockInputs = {
  'anthropic-api-key': 'sk-ant-test',
  'github-token': 'ghp_test',
  sources: validSources
}

describe('parseInputs', () => {
  const originalEnvToken = process.env.GITHUB_TOKEN

  afterEach(() => {
    jest.resetAllMocks()
    if (originalEnvToken === undefined) delete process.env.GITHUB_TOKEN
    else process.env.GITHUB_TOKEN = originalEnvToken
  })

  it('throws when anthropic-api-key is missing', () => {
    withInputs({ ...baseValid, 'anthropic-api-key': undefined })
    expect(() => parseInputs()).toThrow(/anthropic-api-key/)
  })

  it('throws when github-token is missing', () => {
    withInputs({ ...baseValid, 'github-token': undefined })
    expect(() => parseInputs()).toThrow(/github-token/)
  })

  it('throws when github-token matches the env GITHUB_TOKEN', () => {
    process.env.GITHUB_TOKEN = 'ghs_default'
    withInputs({ ...baseValid, 'github-token': 'ghs_default' })
    expect(() => parseInputs()).toThrow(/default GITHUB_TOKEN/)
  })

  it('throws on malformed sources YAML', () => {
    withInputs({ ...baseValid, sources: 'this: : is: not: yaml' })
    expect(() => parseInputs()).toThrow(/not valid YAML/)
  })

  it('throws when a source is missing required fields', () => {
    withInputs({
      ...baseValid,
      sources: 'my-skill:\n  - type: web\n'
    })
    expect(() => parseInputs()).toThrow(
      /sources input failed schema validation/
    )
  })

  it('throws when a source has an unknown type', () => {
    withInputs({
      ...baseValid,
      sources: 'my-skill:\n  - type: ftp\n    url: ftp://x\n'
    })
    expect(() => parseInputs()).toThrow(
      /sources input failed schema validation/
    )
  })

  it('throws when a skill maps to an empty source list', () => {
    withInputs({ ...baseValid, sources: 'my-skill: []\n' })
    expect(() => parseInputs()).toThrow(
      /sources input failed schema validation/
    )
  })

  it('returns parsed inputs and registers both secrets on the happy path', () => {
    withInputs(baseValid)
    const parsed = parseInputs()
    expect(parsed).toEqual({
      sources: {
        'my-skill': [{ type: 'web', url: 'https://example.com/docs' }]
      },
      anthropicApiKey: 'sk-ant-test',
      githubToken: 'ghp_test',
      model: 'claude-opus-4-7',
      branch: 'skill-updater/auto'
    })
    expect(core.setSecret).toHaveBeenCalledWith('sk-ant-test')
    expect(core.setSecret).toHaveBeenCalledWith('ghp_test')
  })

  it('honors model and branch overrides', () => {
    withInputs({
      ...baseValid,
      model: 'claude-haiku-4-5-20251001',
      branch: 'auto/skills'
    })
    const parsed = parseInputs()
    expect(parsed.model).toBe('claude-haiku-4-5-20251001')
    expect(parsed.branch).toBe('auto/skills')
  })

  it('accepts git and rss sources with optional fields', () => {
    withInputs({
      ...baseValid,
      sources: `
multi:
  - type: git
    url: https://github.com/x/y.git
    ref: main
    paths: ['docs/**']
  - type: rss
    url: https://example.com/feed.xml
    max-items: 5
`.trim()
    })
    const parsed = parseInputs()
    expect(parsed.sources.multi).toHaveLength(2)
    expect(parsed.sources.multi[0]).toMatchObject({
      type: 'git',
      ref: 'main',
      paths: ['docs/**']
    })
    expect(parsed.sources.multi[1]).toMatchObject({
      type: 'rss',
      'max-items': 5
    })
  })
})

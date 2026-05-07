/** Structural invariants for buildPrompt. SYSTEM_PROMPT wording is pinned in skillSpec.test.ts. */
import { describe, it, expect } from '@jest/globals'
import { buildPrompt } from '../../src/synthesis/prompt.js'
import { SYSTEM_PROMPT } from '../../src/synthesis/skillSpec.js'

const fetchedAt = new Date('2026-05-07T00:00:00Z')

describe('buildPrompt', () => {
  it('caches system + prior + fetched blocks; leaves the instruction uncached', () => {
    const built = buildPrompt({
      priorSkillMd: '# old skill',
      fetchedDocs: [
        {
          sourceUrl: 'https://x/docs',
          contentType: 'text/html',
          body: 'fresh body',
          fetchedAt
        }
      ]
    })

    expect(built.system).toEqual([
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' }
      }
    ])
    expect(built.messages).toHaveLength(1)
    expect(built.messages[0].role).toBe('user')
    const blocks = built.messages[0].content as Array<{
      type: string
      text: string
      cache_control?: unknown
    }>
    expect(blocks).toHaveLength(3)
    expect(blocks[0].cache_control).toEqual({ type: 'ephemeral' })
    expect(blocks[1].cache_control).toEqual({ type: 'ephemeral' })
    expect(blocks[2].cache_control).toBeUndefined()
  })

  it('embeds prior SKILL.md and marketplace.json with agreed wrapper tags', () => {
    const built = buildPrompt({
      priorSkillMd: '# old',
      priorMarketplaceJson: '{"name":"x","version":"1.0.0"}',
      fetchedDocs: []
    })
    const blocks = built.messages[0].content as Array<{ text: string }>
    expect(blocks[0].text).toContain(
      '<prior-skill-md>\n# old\n</prior-skill-md>'
    )
    expect(blocks[0].text).toContain(
      '<prior-marketplace-json>\n{"name":"x","version":"1.0.0"}\n</prior-marketplace-json>'
    )
  })

  it('falls back to a placeholder when there is no prior SKILL.md', () => {
    const built = buildPrompt({ priorSkillMd: '', fetchedDocs: [] })
    const blocks = built.messages[0].content as Array<{ text: string }>
    expect(blocks[0].text).toContain('(no prior SKILL.md)')
  })

  it('emits one <doc> wrapper per fetched document with provenance attrs', () => {
    const built = buildPrompt({
      priorSkillMd: '',
      fetchedDocs: [
        {
          sourceUrl: 'https://a/1',
          contentType: '',
          body: 'body 1',
          fetchedAt
        },
        {
          sourceUrl: 'https://b/2',
          contentType: '',
          body: 'body 2',
          fetchedAt
        }
      ]
    })
    const blocks = built.messages[0].content as Array<{ text: string }>
    expect(blocks[1].text).toContain(
      '<doc src="https://a/1" fetched-at="2026-05-07T00:00:00.000Z">\nbody 1\n</doc>'
    )
    expect(blocks[1].text).toContain(
      '<doc src="https://b/2" fetched-at="2026-05-07T00:00:00.000Z">\nbody 2\n</doc>'
    )
  })

  it('uses an empty <fetched-documents/> tag when there are no fetched docs', () => {
    const built = buildPrompt({ priorSkillMd: '', fetchedDocs: [] })
    const blocks = built.messages[0].content as Array<{ text: string }>
    expect(blocks[1].text).toBe('<fetched-documents/>')
  })
})

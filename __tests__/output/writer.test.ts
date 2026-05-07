import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { DiscoveredSkill } from '../../src/discovery/skills.js'
import { writeSkill } from '../../src/output/writer.js'

let dir: string
const usage = {
  input_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  output_tokens: 0,
  service_tier: 'standard'
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'writer-test-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function makeSkill(
  withMarketplace?: Record<string, unknown>
): Promise<DiscoveredSkill> {
  const skillMdPath = path.join(dir, 'SKILL.md')
  await writeFile(skillMdPath, '# old')
  const skill: DiscoveredSkill = { name: 'x', dir, skillMdPath }
  if (withMarketplace === undefined) return skill
  const marketplaceJsonPath = path.join(dir, 'marketplace.json')
  await writeFile(marketplaceJsonPath, JSON.stringify(withMarketplace, null, 2))
  return { ...skill, marketplaceJsonPath }
}

describe('writeSkill (SKILL.md)', () => {
  it('writes when content changed and reports it', async () => {
    const skill = await makeSkill()
    const out = await writeSkill(skill, {
      skillMd: '# new',
      marketplaceJson: null,
      summary: 's',
      usage
    })
    expect(out.changed).toBe(true)
    expect(out.changedFiles).toEqual([skill.skillMdPath])
    expect(await readFile(skill.skillMdPath, 'utf8')).toBe('# new')
  })

  it('skips when bytes match disk and reports no change', async () => {
    const skill = await makeSkill()
    const out = await writeSkill(skill, {
      skillMd: '# old',
      marketplaceJson: null,
      summary: 's',
      usage
    })
    expect(out.changed).toBe(false)
    expect(out.changedFiles).toEqual([])
  })
})

describe('writeSkill (marketplace.json)', () => {
  it('bumps patch version and merges allow-listed fields', async () => {
    const skill = await makeSkill({
      name: 'x',
      version: '1.2.3',
      description: 'old desc'
    })
    await writeSkill(skill, {
      skillMd: '# new',
      marketplaceJson: { description: 'new desc', name: 'IGNORED' },
      summary: 's',
      usage
    })
    const mp = JSON.parse(await readFile(skill.marketplaceJsonPath!, 'utf8'))
    expect(mp.version).toBe('1.2.4') // patch bumped
    expect(mp.description).toBe('new desc') // allow-listed
    expect(mp.name).toBe('x') // writer-managed; model can't override
  })

  it('falls back to 0.0.1 when existing version is malformed', async () => {
    const skill = await makeSkill({ name: 'x', version: 'not-semver' })
    await writeSkill(skill, {
      skillMd: '# new',
      marketplaceJson: null,
      summary: 's',
      usage
    })
    const mp = JSON.parse(await readFile(skill.marketplaceJsonPath!, 'utf8'))
    expect(mp.version).toBe('0.0.1')
  })
})

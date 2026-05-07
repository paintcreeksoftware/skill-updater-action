/**
 * Unit tests for src/discovery/skills.ts.
 *
 * Each test builds a tmp directory tree with a few SKILL.md files plus
 * surrounding scaffolding (gitignored dirs, marketplace.json companions,
 * etc.) and asserts the walker returns what the plan promises.
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { discoverSkills } from '../../src/discovery/skills.js'

let root: string

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'skill-disco-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

async function writeSkill(
  relDir: string,
  body: string,
  marketplace?: Record<string, unknown>
): Promise<void> {
  const dir = path.join(root, relDir)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'SKILL.md'), body)
  if (marketplace !== undefined)
    await writeFile(
      path.join(dir, 'marketplace.json'),
      JSON.stringify(marketplace, null, 2)
    )
}

describe('discoverSkills', () => {
  it('returns an empty array when the repo has no SKILL.md', async () => {
    expect(await discoverSkills(root)).toEqual([])
  })

  it('finds a SKILL.md at the repo root', async () => {
    await writeSkill('.', '# root skill')
    const skills = await discoverSkills(root)
    expect(skills).toHaveLength(1)
    expect(skills[0]).toMatchObject({
      name: path.basename(root),
      dir: root,
      skillMdPath: path.join(root, 'SKILL.md')
    })
    expect(skills[0].marketplaceJsonPath).toBeUndefined()
  })

  it('finds skills in .claude/skills/<name>/ (per-project layout)', async () => {
    await writeSkill('.claude/skills/drizzle', '# drizzle skill')
    await writeSkill('.claude/skills/linear', '# linear skill')
    const skills = await discoverSkills(root)
    expect(skills.map((s) => s.name).sort()).toEqual(['drizzle', 'linear'])
  })

  it('prefers frontmatter `name:` over directory basename', async () => {
    await writeSkill(
      '.claude/skills/some-folder',
      '---\nname: my-real-name\n---\n# body\n'
    )
    const skills = await discoverSkills(root)
    expect(skills[0].name).toBe('my-real-name')
  })

  it('falls back to marketplace.json `name` when frontmatter has none', async () => {
    await writeSkill('skills/foo', '# no frontmatter here', {
      name: 'mp-name',
      version: '1.0.0'
    })
    const skills = await discoverSkills(root)
    expect(skills[0].name).toBe('mp-name')
    expect(skills[0].marketplaceJsonPath).toBe(
      path.join(root, 'skills/foo/marketplace.json')
    )
  })

  it('falls back to dirname when neither frontmatter nor marketplace.json names the skill', async () => {
    await writeSkill('skills/bare-dir', '# nothing here', {
      version: '1.0.0'
    })
    const skills = await discoverSkills(root)
    expect(skills[0].name).toBe('bare-dir')
  })

  it('skips SKILL.md inside hardcoded ignore dirs', async () => {
    await writeSkill('.claude/skills/keep-me', '# kept')
    await writeSkill('node_modules/some-pkg/example', '# vendored')
    await writeSkill('dist/built', '# built artifact')
    await writeSkill('coverage/report', '# coverage scratch')
    const skills = await discoverSkills(root)
    expect(skills.map((s) => s.name)).toEqual(['keep-me'])
  })

  it('skips SKILL.md matched by .gitignore', async () => {
    await writeFile(path.join(root, '.gitignore'), 'private/\n')
    await writeSkill('public/keep', '# public')
    await writeSkill('private/secret', '# private')
    const skills = await discoverSkills(root)
    expect(skills.map((s) => s.name)).toEqual(['keep'])
  })

  it('records colocated marketplace.json on the discovered skill', async () => {
    await writeSkill('.claude/skills/with-mp', '# with marketplace', {
      name: 'with-mp',
      version: '0.1.0'
    })
    await writeSkill('.claude/skills/no-mp', '# no marketplace')
    const byName = Object.fromEntries(
      (await discoverSkills(root)).map((s) => [s.name, s])
    )
    expect(byName['with-mp'].marketplaceJsonPath).toBe(
      path.join(root, '.claude/skills/with-mp/marketplace.json')
    )
    expect(byName['no-mp'].marketplaceJsonPath).toBeUndefined()
  })

  it('treats a non-string frontmatter `name` as missing and falls through', async () => {
    await writeSkill(
      'skills/numeric-name',
      '---\nname: 123\n---\n# numeric name\n'
    )
    const skills = await discoverSkills(root)
    expect(skills[0].name).toBe('numeric-name')
  })
})

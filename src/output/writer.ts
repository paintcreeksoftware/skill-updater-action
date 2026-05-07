import { writeFile } from 'node:fs/promises'
import type { DiscoveredSkill } from '../discovery/skills.js'
import type { SynthesisResult } from '../synthesis/synthesize.js'
import { wouldChange } from '../util/diff.js'

/** What the writer changed (or didn't) for one skill. */
export interface WriteResult {
  readonly changed: boolean
  readonly changedFiles: readonly string[]
}

/**
 * Write a {@link SynthesisResult} into the skill's directory. v1 of this
 * commit only handles `SKILL.md`; the next commit adds the colocated
 * `marketplace.json` patch-bump + allow-listed merge.
 *
 * Pre-write {@link wouldChange} short-circuits when bytes match disk so
 * unchanged skills don't dirty the working tree.
 */
export async function writeSkill(
  skill: DiscoveredSkill,
  result: SynthesisResult
): Promise<WriteResult> {
  const changedFiles: string[] = []
  if (await wouldChange(skill.skillMdPath, result.skillMd)) {
    await writeFile(skill.skillMdPath, result.skillMd, 'utf8')
    changedFiles.push(skill.skillMdPath)
  }
  return { changed: changedFiles.length > 0, changedFiles }
}

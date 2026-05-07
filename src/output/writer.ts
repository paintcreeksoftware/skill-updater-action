import { readFile, writeFile } from 'node:fs/promises'
import type { DiscoveredSkill } from '../discovery/skills.js'
import type { SynthesisResult } from '../synthesis/synthesize.js'
import { wouldChange } from '../util/diff.js'

/** Allow-listed fields the writer merges from the model's marketplace.json. */
const ALLOWED_MARKETPLACE_FIELDS = ['description', 'updated_at'] as const

/** What the writer changed (or didn't) for one skill. */
export interface WriteResult {
  readonly changed: boolean
  readonly changedFiles: readonly string[]
}

/** Write SynthesisResult to disk; bump marketplace.json if colocated; skip unchanged bytes. */
export async function writeSkill(
  skill: DiscoveredSkill,
  result: SynthesisResult
): Promise<WriteResult> {
  const changedFiles: string[] = []
  if (await wouldChange(skill.skillMdPath, result.skillMd)) {
    await writeFile(skill.skillMdPath, result.skillMd, 'utf8')
    changedFiles.push(skill.skillMdPath)
  }
  const updatedPath = skill.marketplaceJsonPath
  if (updatedPath !== undefined) {
    const existing = JSON.parse(await readFile(updatedPath, 'utf8')) as Record<
      string,
      unknown
    >
    const updated = mergeMarketplace(existing, result.marketplaceJson)
    const serialized = `${JSON.stringify(updated, null, 2)}\n`
    if (await wouldChange(updatedPath, serialized)) {
      await writeFile(updatedPath, serialized, 'utf8')
      changedFiles.push(updatedPath)
    }
  }
  return { changed: changedFiles.length > 0, changedFiles }
}

function mergeMarketplace(
  existing: Record<string, unknown>,
  synthesized: Record<string, unknown> | null
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...existing }
  out.version = bumpPatch(
    typeof existing.version === 'string' ? existing.version : '0.0.0'
  )
  if (synthesized !== null)
    for (const field of ALLOWED_MARKETPLACE_FIELDS)
      if (typeof synthesized[field] === 'string')
        out[field] = synthesized[field]
  return out
}

function bumpPatch(version: string): string {
  const parts = version.split('.')
  if (parts.length !== 3) return '0.0.1'
  const patch = Number.parseInt(parts[2], 10)
  if (Number.isNaN(patch)) return '0.0.1'
  parts[2] = String(patch + 1)
  return parts.join('.')
}

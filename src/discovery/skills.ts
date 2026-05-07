import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { globby } from 'globby'
import matter from 'gray-matter'

/**
 * One Claude skill discovered in the consumer repo. The `name` field is the
 * key the user will reference in the action's `sources` input.
 */
export interface DiscoveredSkill {
  /**
   * The skill's logical name. Resolved (in order) from:
   *   1. the `name:` field in SKILL.md's YAML frontmatter, if present;
   *   2. the `name` field in a colocated `marketplace.json`, if present;
   *   3. the basename of SKILL.md's parent directory.
   */
  readonly name: string
  /** Absolute path to the directory containing SKILL.md. */
  readonly dir: string
  /** Absolute path to the SKILL.md file itself. */
  readonly skillMdPath: string
  /**
   * Absolute path to a colocated `marketplace.json`, if one exists. The
   * orchestrator (PAI-129) bumps its patch version and merges allow-listed
   * fields from the synthesis envelope.
   */
  readonly marketplaceJsonPath?: string
}

/**
 * Directories the walker always skips, in addition to any patterns honored
 * via `.gitignore`. Matches paths *relative* to the repo root.
 */
const HARDCODED_IGNORES = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'coverage/**',
  '.pnpm-store/**'
] as const

/**
 * Walk the consumer repo and return one {@link DiscoveredSkill} per SKILL.md
 * file found. Honors the repo's `.gitignore` plus a hardcoded ignore list
 * for build/cache directories that the user almost certainly doesn't want
 * scanned.
 *
 * The walker does not classify skills by type (per-project vs. marketplace
 * vs. nested); every SKILL.md is a skill, full stop. Whether a colocated
 * `marketplace.json` exists is recorded so the writer can update it.
 *
 * @param rootDir - Absolute path to the consumer repo's root.
 * @returns The discovered skills, in deterministic glob order. Empty array
 * if the repo contains no SKILL.md files.
 */
export async function discoverSkills(
  rootDir: string
): Promise<DiscoveredSkill[]> {
  const matches = await globby(['**/SKILL.md'], {
    cwd: rootDir,
    gitignore: true,
    ignore: [...HARDCODED_IGNORES],
    absolute: true,
    dot: true
  })

  return Promise.all(matches.map((skillMdPath) => buildSkill(skillMdPath)))
}

/**
 * Read a single SKILL.md location and assemble a {@link DiscoveredSkill}
 * record. Resolves the skill's name via the precedence chain documented on
 * the type.
 */
async function buildSkill(skillMdPath: string): Promise<DiscoveredSkill> {
  const dir = path.dirname(skillMdPath)
  const marketplaceJsonPath = path.join(dir, 'marketplace.json')
  const hasMarketplaceJson = await fileExists(marketplaceJsonPath)

  const name = await resolveName({
    skillMdPath,
    marketplaceJsonPath: hasMarketplaceJson ? marketplaceJsonPath : undefined,
    dir
  })

  return {
    name,
    dir,
    skillMdPath,
    ...(hasMarketplaceJson ? { marketplaceJsonPath } : {})
  }
}

interface NameResolutionInput {
  readonly skillMdPath: string
  readonly marketplaceJsonPath: string | undefined
  readonly dir: string
}

/**
 * Apply the naming precedence rule. Frontmatter wins over marketplace.json
 * which wins over directory basename. A non-string `name` value (e.g.
 * accidentally numeric in YAML) is treated as missing and the chain
 * continues.
 */
async function resolveName({
  skillMdPath,
  marketplaceJsonPath,
  dir
}: NameResolutionInput): Promise<string> {
  const frontmatterName = await readFrontmatterName(skillMdPath)
  if (frontmatterName !== undefined) return frontmatterName

  if (marketplaceJsonPath !== undefined) {
    const marketplaceName = await readMarketplaceName(marketplaceJsonPath)
    if (marketplaceName !== undefined) return marketplaceName
  }

  return path.basename(dir)
}

async function readFrontmatterName(
  skillMdPath: string
): Promise<string | undefined> {
  const raw = await readFile(skillMdPath, 'utf8')
  const parsed = matter(raw)
  const value = parsed.data.name
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

async function readMarketplaceName(
  marketplaceJsonPath: string
): Promise<string | undefined> {
  const raw = await readFile(marketplaceJsonPath, 'utf8')
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const value = (parsed as Record<string, unknown>).name
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath)
    return s.isFile()
  } catch {
    return false
  }
}

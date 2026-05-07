import { exec } from '@actions/exec'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { globby } from 'globby'
import type { FetchedDocument } from './types.js'

/**
 * Default file pattern when a git source doesn't set `paths`. README.md is
 * the most consistent place to find documentation across public repos and
 * keeps the synthesis prompt bounded for sources that haven't been
 * explicitly scoped.
 */
const DEFAULT_PATHS: readonly string[] = ['README.md']

/**
 * Shallow-clone a git repo into a unique tmp directory, glob-pick files
 * matching `paths` (default: `README.md`), and emit one
 * {@link FetchedDocument} per matched file. Always cleans up the tmp
 * directory in a `finally` block — even if clone, glob, or readFile throws.
 *
 * @param url - Git URL clonable via the system `git` binary on the runner
 * (`https://`, `git://`, `ssh://`, etc.).
 * @param ref - Branch, tag, or commit-ish to clone. Defaults to the repo's
 * default branch (passed through `--branch` only when set).
 * @param paths - Glob patterns relative to the cloned repo root. When
 * unset, falls back to {@link DEFAULT_PATHS}.
 */
export async function fetchGit(
  url: string,
  ref?: string,
  paths?: readonly string[]
): Promise<FetchedDocument[]> {
  const fetchedAt = new Date()
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-git-'))
  try {
    const cloneArgs = ['clone', '--depth', '1']
    if (ref !== undefined) cloneArgs.push('--branch', ref)
    cloneArgs.push(url, tmpDir)
    await exec('git', cloneArgs)

    const patterns = paths ?? DEFAULT_PATHS
    const matches = await globby([...patterns], {
      cwd: tmpDir,
      absolute: true,
      dot: true
    })

    return await Promise.all(
      matches.map(async (filePath) => {
        const body = await readFile(filePath, 'utf8')
        const relPath = path.relative(tmpDir, filePath)
        return {
          sourceUrl: `${url}#${ref ?? 'HEAD'}:${relPath}`,
          contentType: 'text/plain',
          body,
          fetchedAt
        }
      })
    )
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}

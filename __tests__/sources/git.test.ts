/**
 * Unit tests for src/sources/git.ts.
 *
 * Strategy: instead of mocking @actions/exec / globby / fs, drive the
 * fetcher against a real local-only git repo built up in a tmp directory.
 * This keeps the test honest about the actual exec semantics (clone arg
 * order, --depth, --branch) while staying offline. Tests skip if the
 * runner has no `git` binary on PATH.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach
} from '@jest/globals'
import { exec } from '@actions/exec'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fetchGit } from '../../src/sources/git.js'

let workspace: string
let upstream: string

beforeAll(async () => {
  // Confirm `git` is on PATH; fail loudly with a clear message if not so the
  // test failure points at the runner config rather than the fetcher code.
  await exec('git', ['--version'], { silent: true })
})

beforeEach(async () => {
  workspace = await mkdtemp(path.join(os.tmpdir(), 'git-fetcher-test-'))
  upstream = path.join(workspace, 'upstream')
  await mkdir(upstream, { recursive: true })
  await exec('git', ['init', '--initial-branch=main', '--bare', upstream], {
    silent: true
  })
})

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true })
})

async function pushFiles(files: Record<string, string>): Promise<void> {
  const work = path.join(workspace, 'seed')
  await mkdir(work, { recursive: true })
  await exec('git', ['init', '--initial-branch=main', work], { silent: true })
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(work, rel)
    await mkdir(path.dirname(abs), { recursive: true })
    await writeFile(abs, body)
  }
  const opts = {
    cwd: work,
    silent: true,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t'
    }
  }
  await exec('git', ['add', '.'], opts)
  await exec('git', ['commit', '-m', 'seed'], opts)
  await exec('git', ['remote', 'add', 'origin', upstream], opts)
  await exec('git', ['push', 'origin', 'main'], opts)
}

describe('fetchGit (happy path)', () => {
  it('clones, returns README.md by default, and includes provenance in sourceUrl', async () => {
    await pushFiles({ 'README.md': '# upstream readme' })

    const docs = await fetchGit(upstream, 'main')

    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({
      contentType: 'text/plain',
      body: '# upstream readme'
    })
    expect(docs[0].sourceUrl).toBe(`${upstream}#main:README.md`)
    expect(docs[0].fetchedAt).toBeInstanceOf(Date)
  })
})

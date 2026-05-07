import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { wouldChange } from '../../src/util/diff.js'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'diff-test-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('wouldChange', () => {
  it('returns true when the file does not exist', async () => {
    expect(await wouldChange(path.join(dir, 'missing.md'), 'anything')).toBe(
      true
    )
  })

  it('returns false when existing content matches byte-for-byte', async () => {
    const file = path.join(dir, 'same.md')
    await writeFile(file, 'identical body')
    expect(await wouldChange(file, 'identical body')).toBe(false)
  })

  it('returns true when existing content differs by even one byte', async () => {
    const file = path.join(dir, 'diff.md')
    await writeFile(file, 'old body')
    expect(await wouldChange(file, 'new body')).toBe(true)
  })
})

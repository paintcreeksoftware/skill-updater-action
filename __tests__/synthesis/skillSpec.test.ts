/**
 * Snapshot-style tests for the synthesis spec text. These guard against
 * silent drift in the prompt — particularly the deprecation-preservation
 * rule, which is the action's killer feature versus naive doc-copying.
 */
import { describe, it, expect } from '@jest/globals'
import {
  DEPRECATION_PRESERVATION_RULE,
  SKILL_FORMAT_SPEC,
  SYSTEM_PROMPT
} from '../../src/synthesis/skillSpec.js'

describe('skillSpec', () => {
  it('format spec covers frontmatter, body, length, and code-example invariants', () => {
    expect(SKILL_FORMAT_SPEC).toMatch(/frontmatter/i)
    expect(SKILL_FORMAT_SPEC).toMatch(/description/i)
    expect(SKILL_FORMAT_SPEC).toMatch(/50-300 lines/i)
    expect(SKILL_FORMAT_SPEC).toMatch(/Do not invent code/i)
  })

  it('deprecation rule is preserved verbatim with the must-retain language', () => {
    expect(DEPRECATION_PRESERVATION_RULE).toMatch(
      /MUST explicitly retain the deprecation\s+as a "what NOT to use" instruction/
    )
    expect(DEPRECATION_PRESERVATION_RULE).toMatch(/zod/i)
    expect(DEPRECATION_PRESERVATION_RULE).toMatch(/z\.uuid\(\)/)
  })

  it('system prompt embeds both blocks and no longer prescribes a JSON envelope shape', () => {
    expect(SYSTEM_PROMPT).toContain(SKILL_FORMAT_SPEC)
    expect(SYSTEM_PROMPT).toContain(DEPRECATION_PRESERVATION_RULE)
    // Output shape now lives in the emit_skill_envelope tool's
    // input_schema (synthesize.ts) — not in the prompt text.
    expect(SYSTEM_PROMPT).not.toMatch(/JSON envelope/i)
    expect(SYSTEM_PROMPT).not.toMatch(/```json/)
  })
})

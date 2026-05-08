/**
 * Claude SKILL.md format specification + invariants. Injected verbatim into
 * the synthesis prompt's system block so the model knows the contract for
 * what it's supposed to emit. Lives in its own module so a snapshot test
 * can assert the deprecation-preservation rule is present and unchanged.
 */

/**
 * Describes the SKILL.md output format the synthesis call must produce —
 * frontmatter requirements, body conventions, length targets. The
 * orchestrator's writer (PAI-129) trusts that these conventions hold.
 */
export const SKILL_FORMAT_SPEC = `A Claude SKILL.md is a markdown file with optional YAML frontmatter,
followed by a body of instructions and examples. Conventions:

- The body is the substance — concrete, reusable instructions for the
  assistant, with code examples where they sharpen the intent.
- If frontmatter is present, it has a 'name' field (skill name, kebab-case)
  and a 'description' field (one short sentence describing when the skill
  applies). Other frontmatter fields may exist; preserve anything you don't
  recognize.
- Target length: 50-300 lines of body, depending on skill complexity. A
  skill that just says "use library X" is too thin; one that mirrors X's
  full reference docs is too thick — the goal is "what an assistant needs
  to know when working with X right now."
- Do not invent code examples. Only include code snippets directly
  attributable to the source documents.`

/**
 * The deprecation-preservation rule — the killer feature versus naive
 * doc-copying. A skill's job is to steer the assistant *away* from sharp
 * edges as much as toward current best practice; deleting deprecated info
 * leaves the assistant writing the deprecated forms.
 *
 * This text is matched verbatim by the snapshot test in PAI-128's prompt
 * builder commit so wording drift surfaces in CI before it reaches a real
 * synthesis call.
 */
export const DEPRECATION_PRESERVATION_RULE = `When source documents indicate that an API or feature is deprecated in
favor of a newer one, the SKILL.md MUST explicitly retain the deprecation
as a "what NOT to use" instruction alongside the recommended replacement.
Do not silently delete deprecated information.

Example: if upstream Zod docs deprecate \`z.string().uuid()\` in favor of
\`z.uuid()\`, the skill must say:

  "Do NOT use \`z.string().uuid()\` (deprecated as of zod X.Y); use
  \`z.uuid()\` instead."

The deprecated form is preserved precisely so consumers know to avoid it.
The only time deprecated information is dropped is when the source
documents indicate the API has been fully removed (not just deprecated)
in the version the skill is targeting.`

/**
 * Full system prompt: role + invariants + format spec + deprecation rule.
 * This is the largest cacheable block in the synthesis call and is
 * identical across every per-skill invocation in a given run.
 *
 * Output shape lives in the `emit_skill_envelope` tool's `input_schema`
 * (see synthesize.ts) — the prompt itself does not prescribe a JSON
 * envelope, since asking the model for fenced JSON around payloads
 * that already contain code fences was the v0.1.0 bug.
 */
export const SYSTEM_PROMPT = `You synthesize and update Claude SKILL.md files from upstream source
documents. The user will give you a skill's prior content (if any) and a
fresh batch of fetched documents; produce updated content.

${SKILL_FORMAT_SPEC}

${DEPRECATION_PRESERVATION_RULE}`

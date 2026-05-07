# Skill Updater Action

![Linter](https://github.com/paintcreeksoftware/skill-updater-action/actions/workflows/linter.yml/badge.svg)
![CI](https://github.com/paintcreeksoftware/skill-updater-action/actions/workflows/ci.yml/badge.svg)
![Check dist/](https://github.com/paintcreeksoftware/skill-updater-action/actions/workflows/check-dist.yml/badge.svg)
![CodeQL](https://github.com/paintcreeksoftware/skill-updater-action/actions/workflows/codeql-analysis.yml/badge.svg)
![Coverage](./badges/coverage.svg)

A GitHub Action that keeps the
[Claude SKILL.md](https://docs.anthropic.com/en/docs/agents/skills) files in
your skill repo fresh against upstream sources (web pages, public git repos, RSS
feeds). On each run, the action:

1. Discovers every `SKILL.md` in the consumer repo (auto-detect — no manual
   layout config).
2. Fetches the configured upstream sources for each skill named in the workflow
   input.
3. Calls the [Claude API](https://docs.anthropic.com/en/api/) to synthesize
   updated content from prior SKILL.md + the fresh sources, with prompt caching
   wired so reruns and cross-skill calls are cheap.
4. Writes the updated `SKILL.md` (and bumps a colocated `marketplace.json` patch
   version, if present).
5. Opens or updates a single rolling pull request with all changed skills + a
   token-cost summary, and best-effort enables GitHub auto-merge.

**v1 updates existing skills only.** A `SKILL.md` must already exist in the repo
for the action to find it. Bootstrapping new skills from sources alone is on the
roadmap (see [PAI-122](https://linear.app/paint-creek-software/issue/PAI-122)).

## Quick example

`.github/workflows/skills.yml`:

```yaml
name: Skill Updater
on:
  schedule:
    - cron: '0 7 * * *' # nightly at 07:00 UTC
  workflow_dispatch:

concurrency: skill-updater # never let two runs race the rolling branch

permissions:
  contents: write
  pull-requests: write

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: paintcreeksoftware/skill-updater-action@v1
        with:
          sources: |
            drizzle-orm:
              - type: web
                url: https://orm.drizzle.team/docs/overview
              - type: git
                url: https://github.com/drizzle-team/drizzle-orm.git
                ref: main
                paths: ['changelogs/**/*.md']
            linear-mcp:
              - type: rss
                url: https://linear.app/changelog/rss.xml
                max-items: 10
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          github-token: ${{ secrets.GITHUB_PERSONAL_ACCESS_TOKEN }}
```

## Inputs

| name                | required | default              | description                                                                                                                                                                           |
| ------------------- | -------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sources`           | yes      | —                    | Multi-line YAML map of skill name → list of sources (see below). Names must match a discovered `SKILL.md` location in the repo.                                                       |
| `anthropic-api-key` | yes      | —                    | Anthropic API key for synthesis.                                                                                                                                                      |
| `github-token`      | yes      | —                    | Fine-grained PAT or GitHub App installation token. **Not** the default `GITHUB_TOKEN` (see next section).                                                                             |
| `model`             | no       | `claude-opus-4-7`    | Claude model ID. Cost reporting prices `claude-opus-4-7`, `claude-sonnet-4-6`, and `claude-haiku-4-5-20251001`; unknown models still run but the cost column shows token counts only. |
| `branch`            | no       | `skill-updater/auto` | The rolling branch the action force-pushes to.                                                                                                                                        |

### `sources` schema

```yaml
sources: |
  <skill-name>:
    - type: web
      url: https://...           # required
    - type: git
      url: https://...           # required
      ref: <branch-or-tag>       # optional (defaults to repo default)
      paths: ['glob/**']         # optional (defaults to ['README.md'])
    - type: rss
      url: https://.../feed.xml  # required
      max-items: <integer>       # optional (defaults to 20)
```

A skill name in `sources` that doesn't match any discovered `SKILL.md` is a
fail-fast error at startup — no fetches, no Claude calls. Skills discovered in
the repo with no matching `sources` entry are silently skipped.

## Output

| name     | description                                                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pr-url` | HTTPS URL of the rolling PR. Empty string if no PR was created (nothing changed). Downstream workflow steps can branch on `pr-url == ''` to detect "nothing happened this run." |

The PR body lists every updated skill with its synthesis summary plus a
`## Cost summary` section with total token usage and estimated cost.

## Why the default `GITHUB_TOKEN` doesn't work

A PR created with the default `GITHUB_TOKEN` does not trigger `pull_request` or
`push` workflow runs on the target branch. This is a deliberate GitHub safeguard
against recursive workflow triggers, but it has two consequences for this
action:

1. Required status checks (CI) won't run on the PR, so reviewers can't see test
   results before merging.
2. GitHub auto-merge waits for required checks; with no checks running,
   auto-merge blocks forever.

A fine-grained PAT (or a GitHub App installation token) bypasses the safeguard.
The PAT needs `contents: write` and `pull-requests: write` on the consumer repo.
Store it as a repository secret named `GITHUB_PERSONAL_ACCESS_TOKEN` and pass it
via `github-token: ${{ secrets.GITHUB_PERSONAL_ACCESS_TOKEN }}`.

The action will refuse to start if `github-token` is empty or matches the
default `GITHUB_TOKEN` — fail-fast, no silent fallback.

## What the action will and won't do (v1 scope)

|     |                                                                                     |
| --- | ----------------------------------------------------------------------------------- |
| ✅  | Update existing SKILL.md files (and optional marketplace.json)                      |
| ✅  | Open / update one rolling PR per run, best-effort enable auto-merge                 |
| ✅  | Per-skill cost reporting in the PR body                                             |
| ✅  | Preserve deprecated APIs as "what NOT to use" instructions per the synthesis prompt |
| ❌  | Bootstrap brand-new skills (a SKILL.md must already exist) — see roadmap            |
| ❌  | OpenClaw / custom output formats — out of scope for v1                              |
| ❌  | Modify your repo's git config or write to `~/.gitconfig`                            |

## Development

```bash
corepack enable               # bootstrap pnpm to the pinned packageManager version
pnpm install
pnpm bundle                   # format + rebuild dist/
pnpm test                     # jest with coverage gate at 80%
pnpm lint                     # eslint
```

The action's runtime artifact is `dist/index.js` (rollup-bundled). Source under
`src/`. See the open epic
[PAI-122](https://linear.app/paint-creek-software/issue/PAI-122) for the v1
implementation plan.

## License

MIT — see [LICENSE](./LICENSE).

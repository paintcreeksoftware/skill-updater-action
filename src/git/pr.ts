import * as core from '@actions/core'
import { context, getOctokit } from '@actions/github'
import { formatError } from '../util/logger.js'

const ENABLE_AUTO_MERGE_GQL = `mutation($pullRequestId: ID!) {
  enablePullRequestAutoMerge(input: { pullRequestId: $pullRequestId, mergeMethod: SQUASH }) {
    pullRequest { id }
  }
}`

/**
 * Best-effort GraphQL `enablePullRequestAutoMerge` (SQUASH method). Failure
 * is logged via core.warning and swallowed — the PR stays open and the
 * consumer's own merge mechanism (manual review, Mergify, repo settings)
 * takes over.
 */
export async function tryEnableAutoMerge(
  token: string,
  pullRequestNodeId: string
): Promise<void> {
  const octokit = getOctokit(token)
  try {
    await octokit.graphql(ENABLE_AUTO_MERGE_GQL, {
      pullRequestId: pullRequestNodeId
    })
  } catch (err) {
    core.warning(
      formatError('failed to enable auto-merge (PR remains open)', err)
    )
  }
}

export interface PrInput {
  readonly token: string
  readonly branch: string
  readonly base: string
  readonly title: string
  readonly body: string
}

export interface PrResult {
  readonly url: string
  readonly number: number
  readonly nodeId: string
}

/**
 * Idempotently open or update the rolling PR. If a PR with `head:
 * <owner>:<branch>` is already open, its title and body are updated;
 * otherwise a new PR is created against `base`. Returns the PR's URL,
 * number, and GraphQL node ID (the latter is what `tryEnableAutoMerge`
 * will need on top).
 */
export async function ensurePullRequest(input: PrInput): Promise<PrResult> {
  const octokit = getOctokit(input.token)
  const { owner, repo } = context.repo
  const head = `${owner}:${input.branch}`

  const existing = await octokit.rest.pulls.list({
    owner,
    repo,
    head,
    state: 'open'
  })
  if (existing.data.length > 0) {
    const open = existing.data[0]
    await octokit.rest.pulls.update({
      owner,
      repo,
      pull_number: open.number,
      title: input.title,
      body: input.body
    })
    return { url: open.html_url, number: open.number, nodeId: open.node_id }
  }

  const created = await octokit.rest.pulls.create({
    owner,
    repo,
    head: input.branch,
    base: input.base,
    title: input.title,
    body: input.body
  })
  return {
    url: created.data.html_url,
    number: created.data.number,
    nodeId: created.data.node_id
  }
}

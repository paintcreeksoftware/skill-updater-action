import { describe, it, expect, beforeEach, jest } from '@jest/globals'

const list = jest.fn<(args: unknown) => Promise<unknown>>()
const update = jest.fn<(args: unknown) => Promise<unknown>>()
const create = jest.fn<(args: unknown) => Promise<unknown>>()
const graphql = jest.fn<(query: string, vars: unknown) => Promise<unknown>>()
const warning = jest.fn<(msg: string) => void>()

const octokit = { rest: { pulls: { list, update, create } }, graphql }
const getOctokit = jest.fn<() => typeof octokit>()

jest.unstable_mockModule('@actions/github', () => ({
  getOctokit,
  context: {
    repo: { owner: 'paintcreeksoftware', repo: 'skill-updater-action' }
  }
}))
jest.unstable_mockModule('@actions/core', () => ({ warning }))

const { ensurePullRequest, tryEnableAutoMerge } =
  await import('../../src/git/pr.js')

const baseInput = {
  token: 't',
  branch: 'skill-updater/auto',
  base: 'main',
  title: 'chore(skill): refresh',
  body: 'body'
}

beforeEach(() => {
  jest.resetAllMocks()
  getOctokit.mockReturnValue(octokit)
})

describe('ensurePullRequest', () => {
  it('updates the existing open PR (preserves number, returns html_url)', async () => {
    list.mockResolvedValueOnce({
      data: [{ number: 42, html_url: 'https://gh/pr/42', node_id: 'PR_42' }]
    })
    update.mockResolvedValueOnce({ data: {} })

    const out = await ensurePullRequest(baseInput)

    expect(list).toHaveBeenCalledWith({
      owner: 'paintcreeksoftware',
      repo: 'skill-updater-action',
      head: 'paintcreeksoftware:skill-updater/auto',
      state: 'open'
    })
    expect(update).toHaveBeenCalledWith({
      owner: 'paintcreeksoftware',
      repo: 'skill-updater-action',
      pull_number: 42,
      title: 'chore(skill): refresh',
      body: 'body'
    })
    expect(create).not.toHaveBeenCalled()
    expect(out).toEqual({
      url: 'https://gh/pr/42',
      number: 42,
      nodeId: 'PR_42'
    })
  })

  it('creates a new PR when none exists', async () => {
    list.mockResolvedValueOnce({ data: [] })
    create.mockResolvedValueOnce({
      data: { number: 7, html_url: 'https://gh/pr/7', node_id: 'PR_7' }
    })

    const out = await ensurePullRequest(baseInput)

    expect(create).toHaveBeenCalledWith({
      owner: 'paintcreeksoftware',
      repo: 'skill-updater-action',
      head: 'skill-updater/auto',
      base: 'main',
      title: 'chore(skill): refresh',
      body: 'body'
    })
    expect(update).not.toHaveBeenCalled()
    expect(out.number).toBe(7)
  })
})

describe('tryEnableAutoMerge', () => {
  it('issues the GraphQL mutation with the PR node id', async () => {
    graphql.mockResolvedValueOnce({})
    await tryEnableAutoMerge('t', 'PR_42')
    expect(graphql).toHaveBeenCalledWith(
      expect.stringContaining('enablePullRequestAutoMerge'),
      { pullRequestId: 'PR_42' }
    )
  })

  it('logs core.warning and swallows GraphQL errors (best-effort)', async () => {
    graphql.mockRejectedValueOnce(new Error('auto-merge not enabled in repo'))
    await tryEnableAutoMerge('t', 'PR_42')
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining('failed to enable auto-merge')
    )
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining('auto-merge not enabled in repo')
    )
  })
})

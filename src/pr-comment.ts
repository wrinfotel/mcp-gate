import type { getOctokit } from "@actions/github";

// @actions/github does not guarantee a named Octokit type export across
// minor versions — derive the type from the factory instead.
export type Octokit = ReturnType<typeof getOctokit>;

export const REPORT_MARKER = "<!-- mcp-gate-report -->";

export async function upsertComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<void> {
  const comments = (await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: issueNumber,
  })) as { id: number; body?: string }[];

  const existing = comments.find((c) => c.body?.startsWith(REPORT_MARKER));
  const full = `${REPORT_MARKER}\n${body}`;
  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body: full,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: full,
    });
  }
}

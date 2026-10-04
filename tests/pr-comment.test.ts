import { expect, test, vi } from "vitest";
import { REPORT_MARKER, upsertComment } from "../src/pr-comment.js";

function mockOctokit(existing: { id: number; body: string }[] = []) {
  return {
    paginate: vi.fn(async () => existing),
    rest: {
      issues: {
        listComments: vi.fn(),
        updateComment: vi.fn(async () => {}),
        createComment: vi.fn(async () => {}),
      },
    },
  };
}

test("creates comment when none exists", async () => {
  const ok = mockOctokit();
  await upsertComment(ok as never, "owner", "repo", 42, "REPORT");
  expect(ok.rest.issues.createComment).toHaveBeenCalledWith({
    owner: "owner",
    repo: "repo",
    issue_number: 42,
    body: `${REPORT_MARKER}\nREPORT`,
  });
});

test("updates existing marker comment in place", async () => {
  const ok = mockOctokit([{ id: 7, body: `${REPORT_MARKER}\nOLD` }]);
  await upsertComment(ok as never, "owner", "repo", 42, "NEW");
  expect(ok.rest.issues.updateComment).toHaveBeenCalledWith({
    owner: "owner",
    repo: "repo",
    comment_id: 7,
    body: `${REPORT_MARKER}\nNEW`,
  });
  expect(ok.rest.issues.createComment).not.toHaveBeenCalled();
});

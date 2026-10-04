import { join } from "node:path";
import { expect, test } from "vitest";
import { loadRequirementSet } from "../src/requirements.js";

const yamlPath = join(
  import.meta.dirname,
  "fixtures/requirements-2026-07-28.yaml",
);

test("loads scored scenario lists", () => {
  const set = loadRequirementSet(yamlPath, "2026-07-28");
  expect(set.revision).toBe("2026-07-28");
  expect(set.server).toEqual([
    "server-stateless",
    "tools-list",
    "tools-call-simple-text",
    "completion-complete",
  ]);
  expect(set.client).toEqual(["tools_call", "request-metadata"]);
});

test("loads not-scored entries with reasons", () => {
  const set = loadRequirementSet(yamlPath, "2026-07-28");
  expect(set.notScored).toEqual([
    {
      scenario: "tasks-lifecycle",
      leg: "server",
      reason: "extension",
      note: "SEP-2631 tasks extension",
    },
    { scenario: "json-schema-2020-12", leg: "server", reason: "pending" },
  ]);
});

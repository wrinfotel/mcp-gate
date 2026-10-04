import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { parseStdout } from "../src/parse-stdout.js";
import { buildReport, renderMarkdown } from "../src/report.js";
import { loadRequirementSet } from "../src/requirements.js";
import type { Check, RequirementSet } from "../src/types.js";

const dir = join(import.meta.dirname, "fixtures");
const summary = parseStdout(readFileSync(join(dir, "stdout.txt"), "utf8"));
const set = loadRequirementSet(
  join(dir, "requirements-2026-07-28.yaml"),
  "2026-07-28",
);

// The tier cases need five set scenarios (an exactly-80% full run requires >= 5),
// so the fixture carries a 5th entry (`resources-list`). The coverage and render
// expectations below were derived against the original four scored scenarios,
// so those tests pin that four-entry view of the set.
const set4: RequirementSet = {
  revision: set.revision,
  server: set.server.slice(0, 4),
  client: set.client,
  notScored: set.notScored,
};

test("builds report: coverage counts only set scenarios, tier per SEP-1730", () => {
  const checks = new Map<string, Check[]>([
    [
      "tools-list",
      JSON.parse(readFileSync(join(dir, "checks-failure.json"), "utf8")),
    ],
  ]);
  const r = buildReport(summary, checks, set4, "0.2.0-alpha.12");
  expect(r.coverage).toEqual({ run: 3, total: 4 });
  expect(r.scoredPassed).toBe(2);
  expect(r.scoredFailed).toBe(2);
  expect(r.passRate).toBeCloseTo(0.5);
  expect(r.tier).toBe(0);
});

const five = [
  "server-stateless",
  "tools-list",
  "tools-call-simple-text",
  "completion-complete",
  "resources-list",
];

const mk = (names: string[], failing?: string) => {
  const scenarios = names.map((name) => ({
    name,
    ok: name !== failing,
    passed: name === failing ? 0 : 1,
    failed: name === failing ? 1 : 0,
    scored: true,
  }));
  const failedCount = failing !== undefined && names.includes(failing) ? 1 : 0;
  return buildReport(
    {
      revision: "2026-07-28",
      declaredTotal: names.length,
      scenarios,
      totals: { passed: names.length - failedCount, failed: failedCount },
    },
    new Map(),
    set,
    "v",
  );
};

test.each([
  {
    label: "full run 5/5 passed",
    names: five,
    failing: undefined,
    expected: 1,
  },
  {
    label: "full run with one failure (4/5 = exactly 80%)",
    names: five,
    failing: "server-stateless",
    expected: 2,
  },
  {
    label: "partial run 3 of the set with one failure",
    names: five.slice(0, 3),
    failing: "server-stateless",
    expected: 0,
  },
  {
    label: "partial run 4 of 5 all passed (run < total)",
    names: five.slice(0, 4),
    failing: undefined,
    expected: 0,
  },
])("tier per SEP-1730: $label", ({ names, failing, expected }) => {
  expect(mk(names, failing).tier).toBe(expected);
});

test("renders markdown with summary line, table and collapsible failures", () => {
  const checks = new Map<string, Check[]>([
    [
      "tools-list",
      JSON.parse(readFileSync(join(dir, "checks-failure.json"), "utf8")),
    ],
  ]);
  const md = renderMarkdown(
    buildReport(summary, checks, set4, "0.2.0-alpha.12"),
    "http://localhost:3123/mcp",
  );
  expect(md).toContain("**50% compliant** (2/4 scored scenarios)");
  expect(md).toContain("| ❌ `tools-list` | yes | 0/3 |");
  expect(md).toContain("<details>");
  expect(md).toContain("CompletionComplete");
  expect(md).toContain("MCP-Completion");
});

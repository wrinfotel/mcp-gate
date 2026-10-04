import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { collectChecks } from "../src/collect-checks.js";

const root = mkdtempSync(join(tmpdir(), "mcpgate-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const checks = JSON.parse(
  readFileSync(
    join(import.meta.dirname, "fixtures/checks-failure.json"),
    "utf8",
  ),
);

mkdirSync(join(root, "server-completion-complete-2026-10-04T14-35-40-576Z"));
writeFileSync(
  join(
    root,
    "server-completion-complete-2026-10-04T14-35-40-576Z",
    "checks.json",
  ),
  JSON.stringify(checks),
);
// decoy: не-сценарная директория без timestamp-суффикса
mkdirSync(join(root, "not-a-scenario"));

test("maps results dirs to scenario names, strips prefix and timestamp", () => {
  const m = collectChecks(root);
  expect(m.size).toBe(1);
  expect(m.get("completion-complete")).toHaveLength(2);
});

test("keeps failing checks queryable with spec refs", () => {
  const m = collectChecks(root);
  const fails =
    m.get("completion-complete")?.filter((c) => c.status === "FAILURE") ?? [];
  expect(fails).toHaveLength(1);
  expect(fails[0]?.errorMessage).toContain("Unsupported protocol version");
  expect(fails[0]?.specReferences?.[0]?.url).toMatch(/^https:/);
});

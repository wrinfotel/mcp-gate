import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { parseStdout } from "../src/parse-stdout.js";

const stdout = readFileSync(
  join(import.meta.dirname, "fixtures/stdout.txt"),
  "utf8",
);

test("parses header revision and declared scenario count", () => {
  const s = parseStdout(stdout);
  expect(s.revision).toBe("2026-07-28");
  expect(s.declaredTotal).toBe(50);
});

test("parses scenario result lines with check counts", () => {
  const s = parseStdout(stdout);
  const tools = s.scenarios.find((x) => x.name === "tools-list");
  expect(tools).toMatchObject({ ok: false, passed: 0, failed: 3 });
  const okOnes = s.scenarios.filter((x) => x.ok);
  expect(okOnes.map((x) => x.name)).toContain("tools-call-simple-text");
});

test("marks not-scored scenarios via the trailing block", () => {
  const s = parseStdout(stdout);
  expect(s.scenarios.find((x) => x.name === "tasks-lifecycle")?.scored).toBe(
    false,
  );
  expect(
    s.scenarios.find((x) => x.name === "json-schema-2020-12")?.scored,
  ).toBe(false);
  expect(s.scenarios.find((x) => x.name === "tools-list")?.scored).toBe(true);
});

test("parses check-level totals", () => {
  expect(parseStdout(stdout).totals).toEqual({ passed: 11, failed: 146 });
});

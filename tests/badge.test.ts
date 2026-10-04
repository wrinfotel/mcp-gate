import { expect, test } from "vitest";
import { badgeFor } from "../src/badge.js";
import type { Report } from "../src/types.js";

const base: Report = {
  revision: "2026-07-28",
  runnerVersion: "0.2.0-alpha.12",
  scenarios: [],
  scoredPassed: 37,
  scoredFailed: 0,
  coverage: { run: 37, total: 37 },
  passRate: 1,
  tier: 1,
};

test("tier 1 → brightgreen with percentage", () => {
  expect(badgeFor(base)).toEqual({
    schemaVersion: 1,
    label: "MCP",
    message: "100% compliant · Tier 1",
    color: "brightgreen",
  });
});

test("tier 2 → green, no tier → yellow/red", () => {
  expect(
    badgeFor({ ...base, tier: 2, passRate: 0.85, scoredFailed: 6 }).color,
  ).toBe("green");
  const half = badgeFor({ ...base, tier: 0, passRate: 0.5, scoredFailed: 19 });
  expect(half.message).toBe("50% compliant");
  expect(half.color).toBe("yellow");
  expect(
    badgeFor({ ...base, tier: 0, passRate: 0.2, scoredFailed: 30 }).color,
  ).toBe("red");
});

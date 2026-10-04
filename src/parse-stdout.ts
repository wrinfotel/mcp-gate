import type { RunSummary, ScenarioLine } from "./types.js";

const HEADER = /^Running requirements (\S+) \((\d+) scenarios\)/;
const SCENARIO = /^[ ]{0,2}(✓|✗) (\S+): (\d+) passed, (\d+) failed/;
const TOTAL = /^Total: (\d+) passed, (\d+) failed/;
const NOT_SCORED_HDR = /^Not scored for \S+:/;
const NOT_SCORED_LINE = /^[ ]+(✓|✗) (\S+) \(\w[\w-]*\)$/;

export function parseStdout(text: string): RunSummary {
  let revision = "unknown";
  let declaredTotal = 0;
  let totals = { passed: 0, failed: 0 };
  const scenarios: ScenarioLine[] = [];
  const notScoredNames = new Set<string>();
  let inNotScoredBlock = false;

  for (const line of text.split(/\r?\n/)) {
    const h = line.match(HEADER);
    if (h) {
      revision = h[1] ?? "";
      declaredTotal = Number(h[2]);
      continue;
    }
    if (NOT_SCORED_HDR.test(line)) {
      inNotScoredBlock = true;
      continue;
    }
    if (inNotScoredBlock) {
      const ns = line.match(NOT_SCORED_LINE);
      if (ns) {
        notScoredNames.add(ns[2] ?? "");
        continue;
      }
      if (line.trim() !== "") inNotScoredBlock = false; // блок закончился
    }
    const s = line.match(SCENARIO);
    if (s) {
      scenarios.push({
        name: s[2] ?? "",
        ok: s[1] === "✓",
        passed: Number(s[3]),
        failed: Number(s[4]),
        scored: true,
      });
      continue;
    }
    const t = line.match(TOTAL);
    if (t) totals = { passed: Number(t[1]), failed: Number(t[2]) };
  }

  for (const sc of scenarios) {
    if (notScoredNames.has(sc.name)) sc.scored = false;
  }
  return { revision, declaredTotal, scenarios, totals };
}

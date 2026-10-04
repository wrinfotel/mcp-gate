import type {
  Check,
  Report,
  RequirementSet,
  RunSummary,
  ScenarioReport,
} from "./types.js";

export function buildReport(
  summary: RunSummary,
  checks: Map<string, Check[]>,
  set: RequirementSet,
  runnerVersion: string,
): Report {
  const scenarios: ScenarioReport[] = summary.scenarios.map((s) => {
    const all = checks.get(s.name) ?? [];
    return {
      name: s.name,
      scored: s.scored,
      ok: s.ok,
      checksPassed: s.passed,
      checksFailed: s.failed,
      failures: all.filter((c) => c.status === "FAILURE"),
    };
  });

  const scored = scenarios.filter((s) => s.scored);
  const scoredPassed = scored.filter((s) => s.ok).length;
  const scoredFailed = scored.length - scoredPassed;
  const total = set.server.length;
  // coverage.run: сколько scored-сценариев сета реально встретилось в прогоне
  const inSet = new Set(set.server);
  const run = scored.filter((s) => inSet.has(s.name)).length;

  const passRate = total > 0 ? scoredPassed / total : 0;
  const tier: 0 | 1 | 2 =
    total > 0 && run === total && scoredFailed === 0
      ? 1
      : total > 0 && run === total && passRate >= 0.8
        ? 2
        : 0;

  return {
    revision: summary.revision,
    runnerVersion,
    scenarios,
    scoredPassed,
    scoredFailed,
    coverage: { run, total },
    passRate,
    tier,
  };
}

export function renderMarkdown(r: Report, serverUrl: string): string {
  const pct = Math.round(r.passRate * 100);
  const tier =
    r.tier === 1 ? "Tier 1 (100%)" : r.tier === 2 ? "Tier 2 (≥80%)" : "no tier";
  const lines: string[] = [
    `## MCP Conformance — revision ${r.revision}`,
    "",
    `**${pct}% compliant** (${r.scoredPassed}/${r.coverage.total} scored scenarios) · ${tier} · runner \`${r.runnerVersion}\` · server \`${serverUrl}\``,
    "",
    "| Scenario | Scored | Checks |",
    "|---|---|---|",
  ];
  for (const s of r.scenarios) {
    const mark = s.ok ? "✅" : "❌";
    lines.push(
      `| ${mark} \`${s.name}\` | ${s.scored ? "yes" : "no (not scored)"} | ${s.checksPassed}/${s.checksPassed + s.checksFailed} |`,
    );
  }
  const failing = r.scenarios.filter(
    (s) => s.scored && !s.ok && s.failures.length > 0,
  );
  if (failing.length > 0) {
    lines.push("", "<details>", "<summary>Failed checks</summary>", "");
    for (const s of failing) {
      lines.push(`#### \`${s.name}\``, "");
      for (const f of s.failures) {
        const refs = (f.specReferences ?? [])
          .map((x) => `[${x.id}](${x.url})`)
          .join(", ");
        lines.push(`- **${f.name}**${refs ? ` (${refs})` : ""}`);
        if (f.errorMessage)
          lines.push(
            `  - \`${f.errorMessage.replace(/\s+/g, " ").slice(0, 300)}\``,
          );
      }
      lines.push("");
    }
    lines.push("</details>");
  }
  lines.push(
    "",
    `Scenario coverage: **${r.coverage.run}/${r.coverage.total}** of frozen requirement set \`${r.revision}\` · [About tiers (SEP-1730)](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/seps/1730-sdks-tiering-system.mdx)`,
  );
  return lines.join("\n");
}

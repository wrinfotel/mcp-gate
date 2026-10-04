import type { BadgeJson, Report } from "./types.js";

export function badgeFor(r: Report): BadgeJson {
  const pct = Math.round(r.passRate * 100);
  const tier = r.tier === 1 ? " · Tier 1" : r.tier === 2 ? " · Tier 2" : "";
  const color =
    r.tier === 1
      ? "brightgreen"
      : r.tier === 2
        ? "green"
        : pct >= 50
          ? "yellow"
          : "red";
  return {
    schemaVersion: 1,
    label: "MCP",
    message: `${pct}% compliant${tier}`,
    color,
  };
}

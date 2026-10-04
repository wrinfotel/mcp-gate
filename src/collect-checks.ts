import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Check } from "./types.js";

const DIR_NAME =
  /^(server|client)-(.+)-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;

export function collectChecks(resultsDir: string): Map<string, Check[]> {
  const out = new Map<string, Check[]>();
  for (const entry of readdirSync(resultsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const m = entry.name.match(DIR_NAME);
    if (!m) continue;
    const checks = JSON.parse(
      readFileSync(join(resultsDir, entry.name, "checks.json"), "utf8"),
    ) as Check[];
    out.set(m[2] ?? "", checks);
  }
  return out;
}

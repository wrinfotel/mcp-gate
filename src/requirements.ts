import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import type { RequirementSet } from "./types.js";

export function loadRequirementSet(
  yamlPath: string,
  revision: string,
): RequirementSet {
  const doc = parseYaml(readFileSync(yamlPath, "utf8")) as {
    server?: string[];
    client?: string[];
    not_scored?: {
      scenario: string;
      leg: string;
      reason: string;
      note?: string;
    }[];
  };
  return {
    revision,
    server: doc.server ?? [],
    client: doc.client ?? [],
    notScored: doc.not_scored ?? [],
  };
}

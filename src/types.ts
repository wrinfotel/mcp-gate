export interface ScenarioLine {
  name: string;
  ok: boolean; // ✓ / ✗ из итогового блока
  passed: number; // чеки
  failed: number; // чеки
  scored: boolean; // false, если сценарий перечислен в блоке "Not scored"
}

export interface RunSummary {
  revision: string; // "2026-07-28"
  declaredTotal: number; // "(50 scenarios)" из хедера
  scenarios: ScenarioLine[];
  totals: { passed: number; failed: number }; // строка "Total: …" (чек-уровень)
}

export interface SpecRef {
  id: string;
  url: string;
}

export interface Check {
  id: string;
  name: string;
  status: "SUCCESS" | "FAILURE";
  errorMessage?: string;
  specReferences?: SpecRef[];
}

export interface RequirementSet {
  revision: string;
  server: string[];
  client: string[];
  notScored: { scenario: string; leg: string; reason: string }[];
}

export interface ScenarioReport {
  name: string;
  scored: boolean;
  ok: boolean;
  checksPassed: number;
  checksFailed: number;
  failures: Check[];
}

export interface Report {
  revision: string;
  runnerVersion: string;
  scenarios: ScenarioReport[];
  scoredPassed: number;
  scoredFailed: number;
  coverage: { run: number; total: number };
  passRate: number; // 0..1, scoredPassed / total
  tier: 0 | 1 | 2; // 0 = tier не присвоен
}

export interface BadgeJson {
  schemaVersion: 1;
  label: string;
  message: string;
  color: string;
}

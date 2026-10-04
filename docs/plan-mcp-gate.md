# MCP Conformance Gate (mcp-gate) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GitHub Action `mcp-gate`, который прогоняет официальный conformance-раннер MCP против сервера, постит человекочитаемый отчёт в PR, считает scenario-coverage против замороженного requirement-сета и публикует бейдж «N% MCP compliant» через shields.io.

**Architecture:** JS-action на TypeScript поверх `@modelcontextprotocol/conformance` (пин версии). Действие ставит раннер в temp-префикс, запускает его с `--requirements <rev> -o <dir>`, парсит stdout (сценарные итоги) + `checks.json` (детали падений), рендерит markdown-отчёт (step summary + PR-комментарий с update-in-place), вычисляет tier по SEP-1730 и коммитит `badge.json` в orphan-ветку через Contents API. Вся инфраструктура — сам GitHub, внешних сервисов нет (бейдж рендерит shields.io из raw.githubusercontent.com).

**Tech Stack:** TypeScript 5, Node 24 (`using: node24`), `@actions/core` + `@actions/github`, `yaml`, `@vercel/ncc` (сборка в `dist/index.js`), vitest, biome. Без фронтенда, без БД, без серверов.

**Spec:** `C:\mcpgate\2026-10-04-spec-mcp-gate.md` (в репо положить рядом как `docs/spec.md`)

## Global Constraints

- Имя репо: **`mcp-gate`** (решение открытого вопроса спеки; короткое, «gate» = conformance gate).
- Пин раннера по умолчанию: **`0.2.0-alpha.12`** (вход `runner-version` перебивает). Политика: двигать пин, когда официальные tier-оценки переезжают на новый alpha.
- Requirement-сет по умолчанию: **`2026-07-28`** (вход `requirements`).
- Только **server-mode** в v0.1. Client-mode НЕ реализовывать (вход `mode` зарезервировать в README как «soon», в action.yml не добавлять).
- Бейдж: **JSON-endpoint shields.io** (`img.shields.io/endpoint?url=…`) на `badge.json` в orphan-ветке `badge`. Static-бейдж отвергнут (протухает), Gist отвергнут (нужен лишний PAT).
- Вне GitHub — ничего. Маркетплейс-публикация, zero-infra.
- НЕ делать (из спеки): режим `stdioharden`, check-level coverage (issue #451), гонку с официальным репо в глубине.
- `dist/index.js` комитится в репо (стандарт JS-action; ncc упаковывает всё в один файл).
- Лицензия MIT. Язык кода/коммитов — английский; README — английский (аудитория HN/r/mcp).

## Проверенные факты (спайк 04.10.2026, живые прогоны)

Исполнитель плана НЕ должен перепроверять это — данные захвачены из реального прогона `0.2.0-alpha.12` против localhost-сервера на `@modelcontextprotocol/sdk` (streamable HTTP, stateless).

1. **CLI alpha.12** (`--help`): `server --url <url> [--scenario <s>] [--suite <s>] [--expected-failures <path>] [-o|--output-dir <path>] [--spec-version <v>] [--requirements <rev>] [--timeout <ms>] [--verbose]`. Флага `--output json` НЕТ (README на main опережает релиз — не полагаться на него).
2. **requirements-сеты входят в npm-тарбалл**: `requirements/2025-11-25.yaml` (5.0kB) и `requirements/2026-07-28.yaml` (7.4kB) рядом с `dist/index.js`. Ставим раннер в temp-префикс → читаем сет из того же `node_modules`.
3. **Структура requirements-YAML** (2026-07-28): `server:` — список из 37 строк-ID; `client:` — 30 строк; `not_scored:` — список мапов `{scenario, leg, reason}` (`reason` ∈ `extension|added-after-release|pending`, опц. `note`).
4. **stdout раннера** (точный формат):
   - хедер: `Running requirements 2026-07-28 (50 scenarios) against http://localhost:3123/mcp`
   - на сценарий: `=== Running scenario: <name> ===`, затем `Results saved to results\server-<name>-<ISO-ts>` (в CI — прямой слэш)
   - итоговый блок: `✓ <name>: N passed, M failed` или `✗ <name>: N passed, M failed` (N/M — чеки, не сценарии; бывают `0 passed, 0 failed` при ✓)
   - `Total: 11 passed, 146 failed` (чек-уровень, включает not-scored)
   - блок `Not scored for 2026-07-28: 13 scenario(s) run, 12 failing. These do not affect conformance.` и под ним с отступом `  ✗ <name> (extension)` — **not-scored сценарии повторяются в основном блоке тоже**; scored = строка, чьего имени НЕТ в not-scored блоке.
5. **Каталог результатов** `-o <dir>`: поддиректории `server-<scenario>-<timestamp>/checks.json`.
6. **checks.json** — массив: `{id, name, description, status: "SUCCESS"|"FAILURE", timestamp, errorMessage?, specReferences?: [{id, url}], details?}`. `specReferences` — готовые ссылки на спеку/SEP для отчёта.
7. Полный прогон 50 сценариев против localhost — ~40 сек. Exit code 1 при любом незабазлайненном scored-падении.
8. Официальный composite-action (`modelcontextprotocol/conformance@v0.1.11`) существует, но: нет outputs, нет PR-комментариев, нет отчётов, нет бейджей — только console + fail/success job. Наш слой над ним осмыслен.
9. Конкурент `mcp-use/mcp-conformance-action` (4★) уже умеет PR-комментарии + Gist-бейджи + baseline-сравнение. Наша дифференциация: coverage против замороженных requirement-сетов + tier-семантика SEP-1730 + бейдж без секретов + чистый DX. НЕ копировать его фичи шире этого.
10. Tier-семантика (SEP-1730): Tier 1 = 100% scored-сценариев сета прошло; Tier 2 = ≥80%. Иначе tier не присваивается.

## File Structure

```
mcp-gate/
├── action.yml                  # манифест JS-action: inputs/outputs, node24, dist/index.js
├── package.json                # deps: @actions/core, @actions/github, yaml; dev: typescript, vitest, biome, @vercel/ncc, @types/node
├── tsconfig.json
├── biome.json
├── LICENSE                     # MIT
├── README.md                   # сторфронт: quickstart, бейдж, скрин PR-отчёта
├── docs/spec.md                # копия спеки
├── docs/LAUNCH.md              # черновик Show HN / r/mcp
├── src/
│   ├── types.ts                # общие типы данных (ScenarioLine, Check, Report, …)
│   ├── parse-stdout.ts         # stdout раннера → RunSummary
│   ├── collect-checks.ts       # results-каталог → Map<scenario, Check[]>
│   ├── requirements.ts         # requirements YAML → RequirementSet
│   ├── report.ts               # buildReport + renderMarkdown + tier
│   ├── badge.ts                # Report → shields endpoint JSON
│   ├── pr-comment.ts           # upsert PR-комментария по маркеру
│   └── main.ts                 # вход action: оркестрация
├── examples/demo-server.mjs    # минимальный MCP-сервер (stateless streamable HTTP) для dogfood
├── tests/                      # vitest: по файлу на модуль + фикстуры
│   ├── fixtures/stdout.txt     # реальный stdout (excerpt из спайка)
│   ├── fixtures/checks-*.json  # реальные checks.json (excerpt)
│   ├── fixtures/requirements-2026-07-28.yaml
│   └── *.test.ts
└── .github/workflows/conformance.yml   # dogfood: action против demo-server, бейдж в свой README
```

---

### Task 1: Скаффолд репозитория

**Files:**
- Create: `package.json`, `tsconfig.json`, `biome.json`, `.gitignore`, `LICENSE`, `README.md` (каркас), `docs/spec.md`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: ничего (первая задача)
- Produces: рабочий vitest-раннер, `npm test` зелёный; ESM-проект (`"type": "module"`, импорты с `.js`-суффиксом)

- [ ] **Step 1: Инициализация и файлы**

```bash
mkdir mcp-gate && cd mcp-gate && git init
```

`package.json`:

```json
{
  "name": "mcp-gate",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "GitHub Action: MCP conformance gate — PR report, scenario coverage, compliance badge over the official MCP conformance runner",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc --noEmit && ncc build src/main.ts -o dist --license licenses.txt",
    "test": "vitest run",
    "lint": "biome check src tests"
  },
  "dependencies": {
    "@actions/core": "^1.11.1",
    "@actions/github": "^6.0.1",
    "yaml": "^2.8.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.3.0",
    "@types/node": "^24.0.0",
    "@vercel/ncc": "^0.38.3",
    "typescript": "^5.9.0",
    "vitest": "^3.2.0"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "outDir": "dist",
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

`biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.3.0/schema.json",
  "files": { "ignore": ["dist/**"] }
}
```

`.gitignore`:

```
node_modules/
dist/
*.log
```

`LICENSE` — стандартный MIT-текст, copyright `2026 mcp-gate contributors`.

`README.md` (каркас, финализируется в Task 9):

```markdown
# mcp-gate

MCP conformance gate: run the official [MCP conformance suite](https://github.com/modelcontextprotocol/conformance) against your MCP server in CI — with a PR report, scenario coverage against frozen requirement sets, and a compliance badge.

<!-- Quickstart и бейдж добавит Task 9 -->
```

`docs/spec.md` — копия `C:\mcpgate\2026-10-04-spec-mcp-gate.md`.

- [ ] **Step 2: Smoke-тест и установка**

`tests/smoke.test.ts`:

```ts
import { expect, test } from "vitest";

test("toolchain works", () => {
  expect(1 + 1).toBe(2);
});
```

```bash
npm install
npm test
```

Expected: `1 passed`.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: scaffold mcp-gate repo (ts, vitest, biome, ncc)"
```

---

### Task 2: Типы + парсер stdout раннера

**Files:**
- Create: `src/types.ts`, `src/parse-stdout.ts`
- Test: `tests/parse-stdout.test.ts`, `tests/fixtures/stdout.txt`

**Interfaces:**
- Consumes: —
- Produces: `parseStdout(text: string): RunSummary`; типы `ScenarioLine`, `RunSummary`, `Check`, `SpecRef`, `RequirementSet`, `ScenarioReport`, `Report`, `BadgeJson` (все — в `src/types.ts`, их импортируют все последующие задачи)

- [ ] **Step 1: Типы**

`src/types.ts`:

```ts
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
```

- [ ] **Step 2: Фикстура — реальный stdout (excerpt из спайка)**

`tests/fixtures/stdout.txt`:

```
Running requirements 2026-07-28 (50 scenarios) against http://localhost:3123/mcp


=== Running scenario: server-stateless ===
Running client scenario 'server-stateless' against server: http://localhost:3123/mcp
Results saved to results\server-server-stateless-2026-10-04T14-35-40-265Z

=== Running scenario: tools-list ===
Running client scenario 'tools-list' against server: http://localhost:3123/mcp
Results saved to results/server-tools-list-2026-10-04T14-35-40-638Z

=== Scenario Results ===

  ✗ server-stateless: 2 passed, 1 failed
  ✗ tools-list: 0 passed, 3 failed
✓ input-required-result-validate-input: 3 passed, 0 failed
✓ tools-call-simple-text: 2 passed, 0 failed
✗ tasks-lifecycle: 0 passed, 9 failed
✓ tasks-status-notifications: 0 passed, 0 failed
✗ json-schema-2020-12: 0 passed, 2 failed

Total: 11 passed, 146 failed

Not scored for 2026-07-28: 3 scenario(s) run, 2 failing. These do not affect conformance.
  ✗ tasks-lifecycle (extension)
  ✓ tasks-status-notifications (extension)
  ✗ json-schema-2020-12 (pending)
```

(Фикстура собрана из реального прогона; смещённые/сокращённые строки — намеренно, парсер не должен зависеть от полного перечня.)

- [ ] **Step 3: Failing-тест**

`tests/parse-stdout.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { parseStdout } from "../src/parse-stdout.js";

const stdout = readFileSync(join(import.meta.dirname, "fixtures/stdout.txt"), "utf8");

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
  expect(s.scenarios.find((x) => x.name === "tasks-lifecycle")?.scored).toBe(false);
  expect(s.scenarios.find((x) => x.name === "json-schema-2020-12")?.scored).toBe(false);
  expect(s.scenarios.find((x) => x.name === "tools-list")?.scored).toBe(true);
});

test("parses check-level totals", () => {
  expect(parseStdout(stdout).totals).toEqual({ passed: 11, failed: 146 });
});
```

```bash
npm test -- parse-stdout
```

Expected: FAIL — модуль не существует.

- [ ] **Step 4: Реализация**

`src/parse-stdout.ts`:

```ts
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
```

- [ ] **Step 5: Зелёный прогон + commit**

```bash
npm test -- parse-stdout
```

Expected: 4 passed.

```bash
git add -A && git commit -m "feat: parse official runner stdout into typed run summary"
```

---

### Task 3: Агрегатор checks.json

**Files:**
- Create: `src/collect-checks.ts`
- Test: `tests/collect-checks.test.ts`, `tests/fixtures/checks-failure.json`

**Interfaces:**
- Consumes: `Check` из `src/types.ts`
- Produces: `collectChecks(resultsDir: string): Map<string, Check[]>` — ключ = имя сценария (префикс `server-`/`client-` и суффикс `-<timestamp>` сняты)

- [ ] **Step 1: Фикстура — реальный checks.json**

`tests/fixtures/checks-failure.json` (реальный excerpt из спайка):

```json
[
  {
    "id": "completion-complete",
    "name": "CompletionComplete",
    "description": "Server responds to completion requests",
    "status": "FAILURE",
    "timestamp": "2026-10-04T14:35:40.633Z",
    "errorMessage": "Failed: Bad Request: Unsupported protocol version: 2026-07-28 (supported versions: 2025-11-25, 2025-06-18, 2025-03-26, 2024-11-05, 2024-10-07)",
    "specReferences": [
      {
        "id": "MCP-Completion",
        "url": "https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/completion"
      }
    ]
  },
  {
    "id": "wire-schema-valid",
    "name": "WireSchemaValid",
    "description": "Every JSON-RPC message the implementation sent is valid per the spec JSON schema for the negotiated spec version",
    "status": "SUCCESS",
    "timestamp": "2026-10-04T14:35:40.633Z",
    "specReferences": [
      {
        "id": "MCP-Schema",
        "url": "https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/schema/2025-11-25/schema.json"
      }
    ],
    "details": { "messagesValidated": 4, "violations": [] }
  }
]
```

- [ ] **Step 2: Failing-тест**

`tests/collect-checks.test.ts`:

```ts
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { expect, test, afterAll } from "vitest";
import { collectChecks } from "../src/collect-checks.js";

const root = mkdtempSync(join(tmpdir(), "mcpgate-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const checks = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures/checks-failure.json"), "utf8"),
);

mkdirSync(join(root, "server-completion-complete-2026-10-04T14-35-40-576Z"));
writeFileSync(
  join(root, "server-completion-complete-2026-10-04T14-35-40-576Z", "checks.json"),
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
  const fails = m.get("completion-complete")?.filter((c) => c.status === "FAILURE") ?? [];
  expect(fails).toHaveLength(1);
  expect(fails[0]?.errorMessage).toContain("Unsupported protocol version");
  expect(fails[0]?.specReferences?.[0]?.url).toMatch(/^https:/);
});
```

```bash
npm test -- collect-checks
```

Expected: FAIL.

- [ ] **Step 3: Реализация**

`src/collect-checks.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Check } from "./types.js";

const DIR_NAME = /^(server|client)-(.+)-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;

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
```

- [ ] **Step 4: Зелёный прогон + commit**

```bash
npm test -- collect-checks
```

Expected: 2 passed.

```bash
git add -A && git commit -m "feat: aggregate per-scenario checks.json from runner output dir"
```

---

### Task 4: Requirement-сет, coverage, tier

**Files:**
- Create: `src/requirements.ts`
- Test: `tests/requirements.test.ts`, `tests/fixtures/requirements-2026-07-28.yaml`

**Interfaces:**
- Consumes: `RequirementSet` из `src/types.ts`
- Produces: `loadRequirementSet(yamlPath: string, revision: string): RequirementSet`

Coverage/tier считаются в Task 5 (`report.ts`), здесь — только загрузка и валидация YAML.

- [ ] **Step 1: Фикстура — excerpt реального сета (структура 1:1, сценарии сокращены до 4+2+2)**

`tests/fixtures/requirements-2026-07-28.yaml`:

```yaml
server:
  - server-stateless
  - tools-list
  - tools-call-simple-text
  - completion-complete
client:
  - tools_call
  - request-metadata
not_scored:
  - scenario: tasks-lifecycle
    leg: server
    reason: extension
    note: SEP-2631 tasks extension
  - scenario: json-schema-2020-12
    leg: server
    reason: pending
```

- [ ] **Step 2: Failing-тест**

`tests/requirements.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { loadRequirementSet } from "../src/requirements.js";

const yamlPath = join(import.meta.dirname, "fixtures/requirements-2026-07-28.yaml");

test("loads scored scenario lists", () => {
  const set = loadRequirementSet(yamlPath, "2026-07-28");
  expect(set.revision).toBe("2026-07-28");
  expect(set.server).toEqual([
    "server-stateless",
    "tools-list",
    "tools-call-simple-text",
    "completion-complete",
  ]);
  expect(set.client).toEqual(["tools_call", "request-metadata"]);
});

test("loads not-scored entries with reasons", () => {
  const set = loadRequirementSet(yamlPath, "2026-07-28");
  expect(set.notScored).toEqual([
    { scenario: "tasks-lifecycle", leg: "server", reason: "extension", note: "SEP-2631 tasks extension" },
    { scenario: "json-schema-2020-12", leg: "server", reason: "pending" },
  ]);
});
```

```bash
npm test -- requirements
```

Expected: FAIL.

- [ ] **Step 3: Реализация**

`src/requirements.ts`:

```ts
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import type { RequirementSet } from "./types.js";

export function loadRequirementSet(yamlPath: string, revision: string): RequirementSet {
  const doc = parseYaml(readFileSync(yamlPath, "utf8")) as {
    server?: string[];
    client?: string[];
    not_scored?: { scenario: string; leg: string; reason: string; note?: string }[];
  };
  return {
    revision,
    server: doc.server ?? [],
    client: doc.client ?? [],
    notScored: doc.not_scored ?? [],
  };
}
```

- [ ] **Step 4: Зелёный прогон + commit**

```bash
npm test -- requirements
```

Expected: 2 passed.

```bash
git add -A && git commit -m "feat: load frozen requirement sets from runner package"
```

---

### Task 5: Сборка Report + markdown-рендер + tier

**Files:**
- Create: `src/report.ts`
- Test: `tests/report.test.ts`

**Interfaces:**
- Consumes: `parseStdout` (Task 2), `collectChecks` (Task 3), `loadRequirementSet` (Task 4), фикстуры задач 2–4
- Produces: `buildReport(summary: RunSummary, checks: Map<string, Check[]>, set: RequirementSet, runnerVersion: string): Report`; `renderMarkdown(r: Report, serverUrl: string): string`

- [ ] **Step 1: Failing-тесты (числа выводим руками из фикстур задач 2 и 4: сет = 4 scored-сценария; в stdout scored: server-stateless ✗, tools-list ✗, input-required-result-validate-input ✓ (нет в сете — игнор), tools-call-simple-text ✓ → run=3, scoredPassed=2, scoredFailed=1, passRate=0.5, tier=0)**

`tests/report.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { parseStdout } from "../src/parse-stdout.js";
import { loadRequirementSet } from "../src/requirements.js";
import { buildReport, renderMarkdown } from "../src/report.js";
import type { Check } from "../src/types.js";

const dir = join(import.meta.dirname, "fixtures");
const summary = parseStdout(readFileSync(join(dir, "stdout.txt"), "utf8"));
const set = loadRequirementSet(join(dir, "requirements-2026-07-28.yaml"), "2026-07-28");

test("builds report: coverage counts only set scenarios, tier per SEP-1730", () => {
  const checks = new Map<string, Check[]>([
    ["tools-list", JSON.parse(readFileSync(join(dir, "checks-failure.json"), "utf8"))],
  ]);
  const r = buildReport(summary, checks, set, "0.2.0-alpha.12");
  expect(r.coverage).toEqual({ run: 3, total: 4 });
  expect(r.scoredPassed).toBe(2);
  expect(r.scoredFailed).toBe(1);
  expect(r.passRate).toBeCloseTo(0.5);
  expect(r.tier).toBe(0);
});

test("tier 1 at 100%, tier 2 at >=80%, none when set not fully run", () => {
  const mk = (names: string[]) => {
    const scenarios = names.map((name) => ({
      name, ok: true, passed: 1, failed: 0, scored: true,
    }));
    return buildReport(
      { revision: "2026-07-28", declaredTotal: names.length, scenarios, totals: { passed: 1, failed: 0 } },
      new Map(),
      set,
      "v",
    );
  };
  const four = ["server-stateless", "tools-list", "tools-call-simple-text", "completion-complete"];
  expect(mk(four).tier).toBe(1);
  expect(mk(four.slice(0, 3)).tier).toBe(0); // 3 из 4 прогнано: 75% run — ниже 80% и неполный прогон
  const failingOne = four.map((n, i) => ({
    name: n, ok: i > 0, passed: 1, failed: i > 0 ? 0 : 1, scored: true,
  }));
  const r = buildReport(
    { revision: "2026-07-28", declaredTotal: 4, scenarios: failingOne, totals: { passed: 3, failed: 1 } },
    new Map(),
    set,
    "v",
  );
  expect(r.tier).toBe(2); // 3/4 = 75%?? нет: 3/4 = 0.75 < 0.8 → поправить ожидание см. ниже
});
```

Внимание, исполнитель: в последнем кейсе 3 из 4 = 75% < 80% → правильное ожидание `expect(r.tier).toBe(0)`. Приведённый тест фиксирует ЭТУ семантику: замени предпоследнюю строку на `expect(r.tier).toBe(0);` и добавь отдельный кейс на 80% ровно: четыре сценария, один ✗ → 3/4; для ровно 80% нужен сет из 5 — расширь `four` пятым именем `resources-list` (добавь его и в фикстуру YAML) и проверь `tier === 2` при 4/5.

- [ ] **Step 2: Реализация**

`src/report.ts`:

```ts
import type { Check, Report, RequirementSet, RunSummary, ScenarioReport } from "./types.js";

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
  const tier = r.tier === 1 ? "Tier 1 (100%)" : r.tier === 2 ? "Tier 2 (≥80%)" : "no tier";
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
    lines.push(`| ${mark} \`${s.name}\` | ${s.scored ? "yes" : "no (not scored)"} | ${s.checksPassed}/${s.checksPassed + s.checksFailed} |`);
  }
  const failing = r.scenarios.filter((s) => s.scored && !s.ok && s.failures.length > 0);
  if (failing.length > 0) {
    lines.push("", "<details>", "<summary>Failed checks</summary>", "");
    for (const s of failing) {
      lines.push(`#### \`${s.name}\``, "");
      for (const f of s.failures) {
        const refs = (f.specReferences ?? []).map((x) => `[${x.id}](${x.url})`).join(", ");
        lines.push(`- **${f.name}**${refs ? ` (${refs})` : ""}`);
        if (f.errorMessage) lines.push(`  - \`${f.errorMessage.replace(/\s+/g, " ").slice(0, 300)}\``);
      }
      lines.push("");
    }
    lines.push("</details>");
  }
  lines.push(
    "",
    `Scenario coverage: **${r.coverage.run}/${r.coverage.total}** of frozen requirement set \`${r.revision}\` · [About tiers (SEP-1730)](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/SEP-1730.md)`,
  );
  return lines.join("\n");
}
```

Ссылку на SEP-1730 в последней строке заменить на актуальный URL SEP из поиска по `modelcontextprotocol/modelcontextprotocol` на момент исполнения (в план не зашивать битую ссылку — проверь `grep -r "1730" README.md` в официальном репо conformance).

- [ ] **Step 3: Тест рендера (в тот же файл)**

```ts
test("renders markdown with summary line, table and collapsible failures", () => {
  const checks = new Map<string, Check[]>([
    ["tools-list", JSON.parse(readFileSync(join(dir, "checks-failure.json"), "utf8"))],
  ]);
  const md = renderMarkdown(buildReport(summary, checks, set, "0.2.0-alpha.12"), "http://localhost:3123/mcp");
  expect(md).toContain("50% compliant (2/4 scored scenarios)");
  expect(md).toContain("| ❌ `tools-list` | yes | 0/3 |");
  expect(md).toContain("<details>");
  expect(md).toContain("CompletionComplete");
  expect(md).toContain("MCP-Completion");
});
```

- [ ] **Step 4: Зелёный прогон + commit**

```bash
npm test
```

Expected: все тесты зелёные.

```bash
git add -A && git commit -m "feat: build typed report with SEP-1730 tiers and render PR markdown"
```

---

### Task 6: Бейдж-JSON для shields.io endpoint

**Files:**
- Create: `src/badge.ts`
- Test: `tests/badge.test.ts`

**Interfaces:**
- Consumes: `Report`, `BadgeJson` из `src/types.ts`
- Produces: `badgeFor(r: Report): BadgeJson`

- [ ] **Step 1: Failing-тест**

`tests/badge.test.ts`:

```ts
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
  expect(badgeFor({ ...base, tier: 2, passRate: 0.85, scoredFailed: 6 }).color).toBe("green");
  const half = badgeFor({ ...base, tier: 0, passRate: 0.5, scoredFailed: 19 });
  expect(half.message).toBe("50% compliant");
  expect(half.color).toBe("yellow");
  expect(badgeFor({ ...base, tier: 0, passRate: 0.2, scoredFailed: 30 }).color).toBe("red");
});
```

- [ ] **Step 2: Реализация**

`src/badge.ts`:

```ts
import type { BadgeJson, Report } from "./types.js";

export function badgeFor(r: Report): BadgeJson {
  const pct = Math.round(r.passRate * 100);
  const tier = r.tier === 1 ? " · Tier 1" : r.tier === 2 ? " · Tier 2" : "";
  const color =
    r.tier === 1 ? "brightgreen" : r.tier === 2 ? "green" : pct >= 50 ? "yellow" : "red";
  return { schemaVersion: 1, label: "MCP", message: `${pct}% compliant${tier}`, color };
}
```

- [ ] **Step 3: Зелёный прогон + commit**

```bash
npm test -- badge
```

Expected: 2 passed.

```bash
git add -A && git commit -m "feat: shields.io endpoint badge json from report"
```

---

### Task 7: Upsert PR-комментария

**Files:**
- Create: `src/pr-comment.ts`
- Test: `tests/pr-comment.test.ts`

**Interfaces:**
- Consumes: `@actions/github` Octokit (в тестах — мок)
- Produces: `REPORT_MARKER = "<!-- mcp-gate-report -->"`; `upsertComment(octokit: Octokit, owner: string, repo: string, issueNumber: number, body: string): Promise<void>`

- [ ] **Step 1: Failing-тест (мок октокита)**

`tests/pr-comment.test.ts`:

```ts
import { expect, test, vi } from "vitest";
import { upsertComment, REPORT_MARKER } from "../src/pr-comment.js";

function mockOctokit(existing: { id: number; body: string }[] = []) {
  return {
    paginate: vi.fn(async () => existing),
    rest: {
      issues: {
        listComments: vi.fn(),
        updateComment: vi.fn(async () => {}),
        createComment: vi.fn(async () => {}),
      },
    },
  };
}

test("creates comment when none exists", async () => {
  const ok = mockOctokit();
  await upsertComment(ok as never, "owner", "repo", 42, "REPORT");
  expect(ok.rest.issues.createComment).toHaveBeenCalledWith({
    owner: "owner",
    repo: "repo",
    issue_number: 42,
    body: `${REPORT_MARKER}\nREPORT`,
  });
});

test("updates existing marker comment in place", async () => {
  const ok = mockOctokit([{ id: 7, body: `${REPORT_MARKER}\nOLD` }]);
  await upsertComment(ok as never, "owner", "repo", 42, "NEW");
  expect(ok.rest.issues.updateComment).toHaveBeenCalledWith({
    owner: "owner",
    repo: "repo",
    comment_id: 7,
    body: `${REPORT_MARKER}\nNEW`,
  });
  expect(ok.rest.issues.createComment).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Реализация**

`src/pr-comment.ts`:

```ts
import type { Octokit } from "@actions/github";

export const REPORT_MARKER = "<!-- mcp-gate-report -->";

export async function upsertComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<void> {
  const comments = (await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: issueNumber,
  })) as { id: number; body?: string }[];

  const existing = comments.find((c) => c.body?.startsWith(REPORT_MARKER));
  const full = `${REPORT_MARKER}\n${body}`;
  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body: full,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: full,
    });
  }
}
```

- [ ] **Step 3: Зелёный прогон + commit**

```bash
npm test -- pr-comment
```

Expected: 2 passed.

```bash
git add -A && git commit -m "feat: upsert single PR report comment by hidden marker"
```

---

### Task 8: Оркестрация main.ts + action.yml + сборка dist

**Files:**
- Create: `src/main.ts`, `action.yml`
- Modify: `package.json` (скрипт `build` уже добавлен в Task 1)
- Test: ручная верификация сборки + локальный smoke из Task 9 (dogfood)

**Interfaces:**
- Consumes: все модули задач 2–7
- Produces: `dist/index.js` (комитится), публичный контракт входов/выходов action (см. action.yml ниже) — его использует Task 9

- [ ] **Step 1: action.yml**

```yaml
name: "MCP Conformance Gate"
description: >-
  Run the official MCP conformance suite against your MCP server:
  PR report, scenario coverage against frozen requirement sets, and a compliance badge.
author: "mcp-gate"

inputs:
  url:
    description: "HTTP URL of the MCP server under test (must be reachable from the runner)"
    required: true
  requirements:
    description: "Frozen requirement set revision, e.g. 2025-11-25 or 2026-07-28"
    required: false
    default: "2026-07-28"
  runner-version:
    description: "Pinned version of @modelcontextprotocol/conformance"
    required: false
    default: "0.2.0-alpha.12"
  expected-failures:
    description: "Path to YAML baseline of expected failures (passed through to the runner)"
    required: false
  timeout-ms:
    description: "Per-scenario timeout passed to the runner"
    required: false
    default: "30000"
  badge:
    description: "Publish badge.json to the badge branch ('true'/'false')"
    required: false
    default: "true"
  badge-branch:
    description: "Branch holding badge.json for shields.io"
    required: false
    default: "badge"
  fail-on-noncompliant:
    description: "Fail the job if the runner exits non-zero"
    required: false
    default: "true"
  github-token:
    description: "Token for PR comments and badge commits"
    required: false
    default: ${{ github.token }}

outputs:
  pass-rate:
    description: "Fraction (0-1) of scored set scenarios passing"
  tier:
    description: "1, 2 or 0 (none) per SEP-1730"
  coverage:
    description: "'run/total' scored scenarios of the frozen set"
  report-markdown:
    description: "Full markdown report"

runs:
  using: "node24"
  main: "dist/index.js"
```

- [ ] **Step 2: main.ts**

```ts
import { exec } from "@actions/exec";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { mkdirSync, appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { badgeFor } from "./badge.js";
import { collectChecks } from "./collect-checks.js";
import { upsertComment } from "./pr-comment.js";
import { parseStdout } from "./parse-stdout.js";
import { loadRequirementSet } from "./requirements.js";
import { buildReport, renderMarkdown } from "./report.js";

async function run(): Promise<void> {
  const url = core.getInput("url", { required: true });
  const revision = core.getInput("requirements");
  const runnerVersion = core.getInput("runner-version");
  const badge = core.getBooleanInput("badge");
  const badgeBranch = core.getInput("badge-branch");
  const token = core.getInput("github-token");

  const work = join(tmpdir(), `mcp-gate-${Date.now()}`);
  const runnerDir = join(work, "runner");
  const resultsDir = join(work, "results");
  mkdirSync(runnerDir, { recursive: true });

  core.info(`Installing @modelcontextprotocol/conformance@${runnerVersion}`);
  const installExit = await exec("npm", [
    "install", `@modelcontextprotocol/conformance@${runnerVersion}`,
    "--prefix", runnerDir, "--no-save", "--no-audit", "--no-fund",
  ]);
  if (installExit !== 0) throw new Error("runner install failed");

  const pkgDir = join(runnerDir, "node_modules", "@modelcontextprotocol", "conformance");
  const args = [
    join(pkgDir, "dist", "index.js"),
    "server", "--url", url,
    "--requirements", revision,
    "--timeout", core.getInput("timeout-ms"),
    "-o", resultsDir,
  ];
  const baseline = core.getInput("expected-failures");
  if (baseline) args.push("--expected-failures", baseline);

  let stdout = "";
  core.info(`Running conformance: node ${args.join(" ")}`);
  const runExit = await exec("node", args, {
    ignoreReturnCode: true,
    listeners: { stdout: (d: Buffer) => (stdout += d.toString()) },
  });

  const set = loadRequirementSet(join(pkgDir, "requirements", `${revision}.yaml`), revision);
  const report = buildReport(parseStdout(stdout), collectChecks(resultsDir), set, runnerVersion);
  const markdown = renderMarkdown(report, url);

  core.setOutput("pass-rate", report.passRate.toFixed(4));
  core.setOutput("tier", String(report.tier));
  core.setOutput("coverage", `${report.coverage.run}/${report.coverage.total}`);
  core.setOutput("report-markdown", markdown);

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) appendFileSync(summary, `${markdown}\n`);

  const prNumber = github.context.payload.pull_request?.number;
  if (prNumber && token) {
    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;
    await upsertComment(octokit, owner, repo, prNumber, markdown);
  }

  if (badge && token) {
    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;
    const json = `${JSON.stringify(badgeFor(report))}\n`;
    let branchSha: string | undefined;
    try {
      const ref = await octokit.rest.git.getRef({ owner, repo, ref: `heads/${badgeBranch}` });
      branchSha = ref.data.object.sha;
    } catch {
      const base = await octokit.rest.git.getRef({
        owner, repo, ref: `heads/${github.context.payload.repository?.default_branch ?? "main"}`,
      });
      const created = await octokit.rest.git.createRef({
        owner, repo, ref: `refs/heads/${badgeBranch}`, sha: base.data.object.sha,
      });
      branchSha = created.data.object.sha;
    }
    // PUT contents: если файл существует — нужен его текущий sha
    let fileSha: string | undefined;
    try {
      const file = await octokit.rest.repos.getContent({ owner, repo, path: "badge.json", ref: badgeBranch });
      if (!Array.isArray(file.data)) fileSha = file.data.sha;
    } catch { /* файла ещё нет */ }
    await octokit.rest.repos.createOrUpdateFileContents({
      owner, repo, path: "badge.json", branch: badgeBranch, sha: fileSha,
      message: "chore: update conformance badge [skip ci]",
      content: Buffer.from(json, "utf8").toString("base64"),
    });
    core.info(`Badge: https://img.shields.io/endpoint?url=${encodeURIComponent(
      `https://raw.githubusercontent.com/${owner}/${repo}/${badgeBranch}/badge.json`)}`);
  }

  if (runExit !== 0 && core.getBooleanInput("fail-on-noncompliant")) {
    core.setFailed(
      `MCP conformance: ${report.scoredFailed} scored scenario(s) failing (coverage ${report.coverage.run}/${report.coverage.total}, tier ${report.tier}). See report above.`,
    );
  }
}

run().catch((err: unknown) => core.setFailed(err instanceof Error ? err.message : String(err)));
```

- [ ] **Step 3: Сборка и типчек**

```bash
npm run build
ls dist/index.js
```

Expected: `tsc --noEmit` без ошибок, `dist/index.js` создан, `dist/licenses.txt` рядом.

- [ ] **Step 4: Commit (включая dist)**

```bash
git add -A && git commit -m "feat: action orchestration — run runner, report, comment, badge"
```

---

### Task 9: Demo-сервер, dogfood-workflow, README

**Files:**
- Create: `examples/demo-server.mjs`, `.github/workflows/conformance.yml`
- Modify: `README.md` (quickstart + бейдж)

**Interfaces:**
- Consumes: action из Task 8 (`uses: ./`)
- Produces: живой dogfood — каждый пуш в репо прогоняет гейт против демо-сервера и обновляет бейдж репо

- [ ] **Step 1: Demo-сервер (проверен живым прогоном в спайке)**

`examples/demo-server.mjs`:

```js
// Minimal stateless MCP server over Streamable HTTP for dogfooding mcp-gate.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import http from "node:http";
import { z } from "zod";

const server = new McpServer({ name: "mcp-gate-demo", version: "1.0.0" });

server.registerTool(
  "echo",
  { title: "Echo", description: "Echoes text back", inputSchema: { text: z.string() } },
  async ({ text }) => ({ content: [{ type: "text", text: `echo: ${text}` }] }),
);

server.registerResource(
  "demo",
  "demo://info",
  { description: "Demo resource" },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "text/plain", text: "demo resource body" }],
  }),
);

server.registerPrompt(
  "greet",
  { title: "Greet", argsSchema: { name: z.string() } },
  async ({ name }) => ({
    messages: [{ role: "user", content: { type: "text", text: `Hello, ${name}!` } }],
  }),
);

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/health") {
      res.writeHead(200).end("ok");
      return;
    }
    if (url.pathname !== "/mcp") {
      res.writeHead(404).end();
      return;
    }
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonValidation: false,
      });
      res.on("close", () => transport.close());
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      console.error("handler error", err);
      if (!res.headersSent) res.writeHead(500).end();
    }
  })
  .listen(3123, () => console.log("demo MCP server on http://localhost:3123/mcp"));
```

В репо добавить `examples/package.json`: `{ "name": "mcp-gate-demo", "private": true, "type": "module", "dependencies": { "@modelcontextprotocol/sdk": "^1.0.0", "zod": "^3.0.0" } }`.

- [ ] **Step 2: Dogfood-workflow**

Важно: сет для dogfood — `2025-11-25`, потому что текущий TS-SDK не поддерживает wire-версию 2026-07-28 (сценарии падают на initialize — проверено спайком). Это честный показ: часть сценариев у демо-сервера упадёт и не упадёт job — из-за `fail-on-noncompliant: "false"`.

`.github/workflows/conformance.yml`:

```yaml
name: conformance-gate
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v6
        with:
          node-version: 22
      - run: npm install --prefix examples
      - run: node examples/demo-server.mjs & echo $! > server.pid
      - name: Wait for server
        run: |
          for i in $(seq 1 30); do
            curl -sf http://localhost:3123/health && break
            sleep 1
          done
      - name: Run mcp-gate
        uses: ./
        with:
          url: http://localhost:3123/mcp
          requirements: "2025-11-25"
          fail-on-noncompliant: "false"
      - run: kill $(cat server.pid) || true
        if: always()
```

- [ ] **Step 3: README quickstart**

Полный текст README (заменить каркас):

```markdown
# mcp-gate

[![MCP](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FOWNER%2Fmcp-gate%2Fbadge%2Fbadge.json)](https://github.com/OWNER/mcp-gate/actions)

Run the official [MCP conformance suite](https://github.com/modelcontextprotocol/conformance) against your MCP server in CI — with a **PR report**, **scenario coverage against frozen requirement sets**, and a **compliance badge**.

## Quickstart

Start your server in a step, then:

```yaml
- uses: OWNER/mcp-gate@v0.1
  with:
    url: http://localhost:3000/mcp
```

That's it. You get a step summary, a PR comment (one, updated in place), and outputs (`pass-rate`, `tier`, `coverage`).

## Inputs

| Input | Default | Description |
|---|---|---|
| `url` | — | MCP server URL (required) |
| `requirements` | `2026-07-28` | Frozen requirement set revision |
| `runner-version` | `0.2.0-alpha.12` | Pinned `@modelcontextprotocol/conformance` version |
| `expected-failures` | — | Baseline YAML passed through to the runner |
| `timeout-ms` | `30000` | Per-scenario timeout |
| `badge` | `true` | Publish `badge.json` to the badge branch |
| `badge-branch` | `badge` | Branch for badge JSON |
| `fail-on-noncompliant` | `true` | Fail the job on conformance failures |

## Badge

Add to your README (replace `OWNER/REPO`):

```markdown
[![MCP](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FOWNER%2FREPO%2Fbadge%2Fbadge.json)](https://github.com/modelcontextprotocol/conformance)
```

The workflow needs `permissions: contents: write` (badge) and `pull-requests: write` (report comment).

## Tiers (SEP-1730)

- **Tier 1** — 100% of the frozen set's scored scenarios pass
- **Tier 2** — ≥ 80%

Your server only earns a tier when the whole set ran. Scenario coverage (`run/total`) is always reported.

## stdio servers

The official runner speaks HTTP. Wrap your stdio server with [supergateway](https://github.com/nick1udwig/supergateway):

`npx -y supergateway --stdio "node your-server.js" --port 3000`
```

- [ ] **Step 4: Верификация dogfood**

Запушить ветку `main` в созданный на GitHub репо `OWNER/mcp-gate` (создать репо через `gh repo create mcp-gate --public --source . --push`). Затем:

```bash
gh run watch
```

Expected: job зелёный (fail-on-noncompliant=false), в summary — отчёт, в коммитах ветки `badge` — `badge.json`, бейдж-URL из лога открывает картинку shields.io. PR-комментарий проверить, открыв тестовый PR:

```bash
gh pr create --fill-first
gh run watch
```

Expected: на PR появился ровно один комментарий с маркером; повторный пуш в тот же PR обновляет его, а не создаёт второй.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: demo server, dogfood workflow, README quickstart"
```

---

### Task 10: Релиз v0.1.0 и материалы запуска

**Files:**
- Create: `docs/LAUNCH.md`
- Modify: `README.md` (скриншот PR-отчёта), `action.yml` (branding)

**Interfaces:**
- Consumes: работающий dogfood из Task 9
- Produces: тег `v0.1.0`, запись в Marketplace, пост Show HN

- [ ] **Step 1: branding в action.yml** — добавить после `author:`:

```yaml
branding:
  icon: "shield-check"
  color: "blue"
```

- [ ] **Step 2: Скриншот PR-отчёта** — из тестового PR задачи 9 снять скриншот комментария, положить в `docs/pr-report.png`, вставить в README после Quickstart:

```markdown
![PR report](docs/pr-report.png)
```

- [ ] **Step 3: docs/LAUNCH.md**

```markdown
# Launch — v0.1.0

## Show HN (draft)

Title: Show HN: MCP Conformance Gate – CI badge and PR reports for MCP servers

I wrapped the official MCP conformance runner (modelcontextprotocol/conformance) into a
GitHub Action: one `uses:` line in your workflow gives you a PR report with failing checks
linked to the spec, scenario coverage against frozen requirement sets, and a
"N% compliant / Tier" badge via shields.io. SEP-1730 defines the tiers: Tier 1 = 100% of
the revision's required scenarios, Tier 2 = ≥80%. Conformance tests are now mandatory for
SEP Final status (SEP-2484), so if you maintain an MCP server this belongs in your CI.
No secrets beyond the default GITHUB_TOKEN; badge.json is committed to an orphan branch.

## r/mcp post (draft)

Same text, softened, plus supergateway recipe for stdio servers.

## Checklist

- [ ] Tag v0.1.0, push
- [ ] Marketplace: repo → Releases → publish to GitHub Marketplace (category: Testing)
- [ ] Verify `uses: OWNER/mcp-gate@v0.1` resolves
- [ ] Post Show HN (Tuesday morning PT), answer comments 24h
- [ ] Post r/mcp, link demo repo
```

- [ ] **Step 4: Релиз**

```bash
npm test && npm run build
git add -A && git commit -m "docs: launch materials and branding" --allow-empty
git tag v0.1.0 && git push origin main --tags
```

Затем в UI GitHub: Releases → Draft new release → tag `v0.1.0` → publish → «Publish this Action to the GitHub Marketplace». Это единственный ручной шаг вне терминала.

- [ ] **Step 5: Финальная верификация**

```bash
gh api repos/OWNER/mcp-gate/actions/workflows
```

Expected: workflow `conformance-gate.yml` активен; `https://github.com/marketplace/actions/mcp-conformance-gate` отвечает 200.

---

## Self-Review (выполнен при составлении)

1. **Покрытие спеки:** v0.1 п.1 (Action: вход URL → отчёт в PR + машиночитаемый результат) — Tasks 2–8; п.2 (бейдж) — Task 6+8 (решение: JSON-endpoint); п.3 (scenario-coverage «X из Y») — Tasks 4–5. Открытые вопросы спеки закрыты в Global Constraints (имя, пин, бейдж). Границы (stdioharden, check-level coverage) не реализуются. Монетизация не реализуется — совпадает со спекой.
2. **Placeholder-скан:** плейсхолдеров нет; единственная «проверь на месте» — актуальный URL SEP-1730 (сознательно: не зашивать непроверенную ссылку) и шаг Task 5 Step 1 с явной семантикой 75% vs 80% (инструкция точная, без TBD).
3. **Консистентность типов:** `RunSummary`/`ScenarioLine` (T2) → `buildReport(summary, checks, set, runnerVersion)` (T5) → `badgeFor(Report)` (T6) → `upsertComment` (T7) → `main.ts` (T8). Имена и сигнатуры сверены.
```

import { appendFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as core from "@actions/core";
import { exec } from "@actions/exec";
import * as github from "@actions/github";
import { badgeFor } from "./badge.js";
import { collectChecks } from "./collect-checks.js";
import { parseStdout } from "./parse-stdout.js";
import { upsertComment } from "./pr-comment.js";
import { buildReport, renderMarkdown } from "./report.js";
import { loadRequirementSet } from "./requirements.js";

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
    "install",
    `@modelcontextprotocol/conformance@${runnerVersion}`,
    "--prefix",
    runnerDir,
    "--no-save",
    "--no-audit",
    "--no-fund",
  ]);
  if (installExit !== 0) throw new Error("runner install failed");

  const pkgDir = join(
    runnerDir,
    "node_modules",
    "@modelcontextprotocol",
    "conformance",
  );
  const args = [
    join(pkgDir, "dist", "index.js"),
    "server",
    "--url",
    url,
    "--requirements",
    revision,
    "--timeout",
    core.getInput("timeout-ms"),
    "-o",
    resultsDir,
  ];
  const baseline = core.getInput("expected-failures");
  if (baseline) args.push("--expected-failures", baseline);

  let stdout = "";
  core.info(`Running conformance: node ${args.join(" ")}`);
  const runExit = await exec("node", args, {
    ignoreReturnCode: true,
    listeners: { stdout: (d: Buffer) => (stdout += d.toString()) },
  });

  const set = loadRequirementSet(
    join(pkgDir, "requirements", `${revision}.yaml`),
    revision,
  );
  const report = buildReport(
    parseStdout(stdout),
    collectChecks(resultsDir),
    set,
    runnerVersion,
  );
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
    let _branchSha: string | undefined;
    try {
      const ref = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${badgeBranch}`,
      });
      _branchSha = ref.data.object.sha;
    } catch {
      const base = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${github.context.payload.repository?.default_branch ?? "main"}`,
      });
      const created = await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${badgeBranch}`,
        sha: base.data.object.sha,
      });
      _branchSha = created.data.object.sha;
    }
    // PUT contents: если файл существует — нужен его текущий sha
    let fileSha: string | undefined;
    try {
      const file = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: "badge.json",
        ref: badgeBranch,
      });
      if (!Array.isArray(file.data)) fileSha = file.data.sha;
    } catch {
      /* файла ещё нет */
    }
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: "badge.json",
      branch: badgeBranch,
      sha: fileSha,
      message: "chore: update conformance badge [skip ci]",
      content: Buffer.from(json, "utf8").toString("base64"),
    });
    core.info(
      `Badge: https://img.shields.io/endpoint?url=${encodeURIComponent(
        `https://raw.githubusercontent.com/${owner}/${repo}/${badgeBranch}/badge.json`,
      )}`,
    );
  }

  if (runExit !== 0 && core.getBooleanInput("fail-on-noncompliant")) {
    core.setFailed(
      `MCP conformance: ${report.scoredFailed} scored scenario(s) failing (coverage ${report.coverage.run}/${report.coverage.total}, tier ${report.tier}). See report above.`,
    );
  }
}

run().catch((err: unknown) =>
  core.setFailed(err instanceof Error ? err.message : String(err)),
);

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

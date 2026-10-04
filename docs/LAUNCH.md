# Launch — v0.1.0

## Show HN (draft)

Title: Show HN: MCP Conformance Gate – CI badge and PR reports for MCP servers

I wrapped the official MCP conformance runner (modelcontextprotocol/conformance) into a
GitHub Action: one `uses:` line in your workflow gives you a PR report with failing checks
linked to the spec, scenario coverage against frozen requirement sets, and a
"N% compliant / Tier" badge via shields.io. SEP-1730 defines the tiers: Tier 1 = 100% of
the revision's required scenarios, Tier 2 = ≥80%. Conformance tests are now mandatory for
SEP Final status (SEP-2484), so if you maintain an MCP server this belongs in your CI.
No secrets beyond the default GITHUB_TOKEN; badge.json is committed to a dedicated badge branch.

## r/mcp post (draft)

Same text, softened, plus supergateway recipe for stdio servers.

## Checklist

- [ ] Tag v0.1.0, push
- [ ] Marketplace: repo → Releases → publish to GitHub Marketplace (category: Testing)
- [ ] Verify `uses: OWNER/mcp-gate@v0.1` resolves
- [ ] Post Show HN (Tuesday morning PT), answer comments 24h
- [ ] Post r/mcp, link demo repo

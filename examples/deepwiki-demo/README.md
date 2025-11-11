# DeepWiki Demo Config

This example integrates the public DeepWiki MCP server (documented at https://docs.devin.ai/work-with-devin/deepwiki-mcp) into Oplink.

## Files

- `.mcp-workflows/servers.json` – registers the HTTP endpoint `https://mcp.deepwiki.com/sse` under the alias `deepwiki`. No API key is required per the official docs.
- `.mcp-workflows/workflows.yaml` – includes both a scripted tool using `deepwiki:ask_question` and an auto‑discovery workflow exposing all DeepWiki tools.

## Usage

```bash
pnpm -r --filter ./packages/oplink dev -- --config examples/deepwiki-demo/.mcp-workflows
```

After Oplink starts, connect your MCP client and run `describe_tools({ "workflow": "deepwiki_auto" })` to confirm `deepwiki:*` tools are available.

Examples:

```json
deepwiki_lookup({ "repo": "facebook/react", "question": "What is concurrent mode?" })
```

```json
// Call a discovered tool via the proxy
deepwiki_auto({
  "tool": "deepwiki:read_wiki_structure",
  "args": { "repoName": "facebook/react" }
})
```

# DeepWiki Demo Config

This example integrates the public DeepWiki MCP server (documented at https://docs.devin.ai/work-with-devin/deepwiki-mcp) into Oplink.

## Files

- `.mcp-workflows/servers.json` – registers the HTTP endpoint `https://mcp.deepwiki.com/sse` under the alias `deepwiki`. No API key is required per the official docs.
- `.mcp-workflows/workflows.yaml` – includes both an explicit proxy (`deepwiki:deepwiki_search`) and an auto-discovery workflow.

## Usage

```bash
pnpm -r --filter ./packages/oplink dev -- --config examples/deepwiki-demo/.mcp-workflows
```

After Oplink starts, connect your MCP client and run `listTools` to confirm `deepwiki:*` tools are available. Call `deepwiki_lookup` with a `query` parameter (e.g., "react server components") to see proxied DeepWiki results.

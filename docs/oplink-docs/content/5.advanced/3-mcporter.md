---
title: How Oplink Uses mcporter
description: Transport, discovery, and auth handoff via mcporter
---

Oplink delegates all communication with external MCP servers to [mcporter](https://www.npmjs.com/package/mcporter). mcporter handles process orchestration (stdio) and HTTP connectors, tool discovery, schema caching, and basic retries.

## Why mcporter
- Stable stdio/HTTP transport to any MCP server
- Catalog discovery and schema normalization
- OAuth hand-off for hosted servers (e.g., Linear)

## Where it fits
1. You declare external servers in `.mcp-workflows/servers.json`.
2. Oplink loads and validates this registry and passes it to mcporter.
3. When a workflow calls an external tool, Oplink forwards the call to mcporter, which launches/connects to the server and executes the tool.
4. Results stream back to Oplink and then to your MCP client (Cursor, Claude, etc.).

## Discovery and caching
- Oplink runs `describe_tools` via mcporter to populate an in-memory cache of tool schemas per alias.
- Workflows that use `externalServers` can proxy any tool from those aliases without copying schemas into your repo.

## Auth handoff
- API keys: use `${ENV_VAR}` placeholders in `servers.json`; Oplink expands them from `process.env` (after auto‑loading `.env` files from your `--config` directory) before creating the mcporter runtime.
- OAuth: for hosted servers (e.g., Linear), use `auth: "oauth"` and run via `npx mcp-remote <endpoint>`. mcporter handles browser/device flow and stores tokens in `tokenCacheDir`.

## Acknowledgements
Special thanks to @steipete for advocacy and early feedback around MCP developer tooling and interop.

## Verify with mcporter
Use mcporter directly to inspect a server alias without running the full Oplink server:

```bash
npx mcporter list linear --config examples/linear-discord-demo/.mcp-workflows
```

If authentication is required, mcporter guides you through the flow.

> Note: All examples in this documentation are illustrative. You can wire in any MCP server (stdio or HTTP), whether it requires OAuth, an API key, or no authentication at all. The mechanics remain the same: declare the server in `servers.json`, supply any required environment variables, and let mcporter handle transport and discovery.

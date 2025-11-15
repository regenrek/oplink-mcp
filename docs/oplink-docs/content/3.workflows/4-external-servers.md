---
title: External Servers & Registry
description: Register external MCP servers and wire them into workflows
---

External MCP servers are declared in `.mcp-workflows/servers.json`. Each entry maps a friendly alias (e.g., `linear`) to either an stdio command or an HTTP endpoint.

Example (stdio + OAuth)

```json
{
  "servers": {
    "linear": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.linear.app/mcp"],
      "auth": "oauth",
      "clientName": "oplink-linear-demo",
      "oauthRedirectUrl": "http://127.0.0.1:22228/oauth/callback",
      "tokenCacheDir": "./.tokens/linear",
      "description": "Linear hosted MCP server"
    }
  }
}
```

Rules

- Oplink auto‑loads `.env` files from your `--config` directory before expansion. Precedence: shell > `.env.{NODE_ENV}.local` > `.env.{NODE_ENV}` > `.env.local` > `.env`.
- Unresolved `${VAR}` placeholders still fail startup (by design).
- IDE config: point your IDE at Oplink only (stdio command). Do not duplicate external servers in IDE files — keep them in `.mcp-workflows/servers.json`.

### IDE Setup (Cursor example)

```json
{
  "mcpServers": {
    "oplink-atlassian": {
      "command": "node",
      "args": [
        "/path/to/repo/packages/cli/bin/oplink.mjs",
        "server",
        "--config",
        "/path/to/repo/examples/atlassian-demo/.mcp-workflows"
      ]
    }
  }
}
```
- `tokenCacheDir` is resolved relative to the config dir.
- `servers.json` must contain at least one server.

OAuth flow cheatsheet

- Start Oplink with `--config` pointing at your `.mcp-workflows`.
- In your IDE, run `describe_tools({ "workflow": "name" })` or call `external_auth_setup()` once.
- Complete the browser/device flow; tokens will be cached under `.tokens/<alias>`.

Auto‑discovery vs scripted

- Use auto‑discovery when you want to expose all tools from an alias quickly.
- Use scripted when you want curated steps, defaults, or composition across aliases.

See also

- Advanced: [mcporter](/advanced/3-mcporter), [authentication](/advanced/4-authentication)

---
title: Auto‑Discovery Workflows
description: Proxy external MCP servers and discover tools on demand
---

Expose existing MCP servers (e.g., Chrome DevTools, shadcn, Context7) without writing custom steps. Declare `externalServers`, and Oplink:

- Caches tool catalogs from those aliases (names, descriptions, JSON Schemas)
- Registers a built‑in `describe_tools` helper for discovery over that cache
- Validates arguments against upstream JSON Schemas when routing calls via workflows

Example

```yaml
frontend_debugger:
  description: "Chrome DevTools helper"
  prompt: |
    Use Chrome DevTools MCP tools (e.g., take_screenshot, list_network_requests).
    Call this workflow with {"tool": "name", "args": { ... }}.
  externalServers:
    - chrome-devtools

full_helper:
  description: "Chrome DevTools + shadcn"
  prompt: |
    Access Chrome DevTools and shadcn MCP tools from one workflow.
  externalServers:
    - chrome-devtools
    - shadcn
```

Usage pattern

1) Discover tools first:

```json
describe_tools({ "workflow": "frontend_debugger" })
```

When a server exposes a large number of tools, you can trim the payload:

```json
describe_tools({
  "workflow": "frontend_debugger",
  "includeSchemas": false,
  "limit": 50
})
```

2) Call a tool by name (optionally prefix with alias when multiple):

```json
frontend_debugger({
  "tool": "take_screenshot",
  "args": { "url": "https://example.com", "format": "png" }
})
```

Tips

- Multiple aliases: either add `server: "alias"` or prefix tool as `alias:tool_name`.
- Refresh discovery: `describe_tools({ "workflow": "frontend_debugger", "refresh": true })`.
- Prewarm all servers once: call `external_auth_setup()` after connecting to trigger OAuth and cache schemas.
- Optional per-tool proxies: if you want one MCP tool per external tool (e.g. `deepwiki.read_wiki_structure`), start Oplink with `OPLINK_AUTO_REGISTER_EXTERNAL_TOOLS=1` or pass `autoRegisterExternalTools: true` to `createMcpServer`. This is primarily useful for debugging; most workflows should stay router-only.

See also

- [External Servers & Registry](./4-external-servers)
- Transport/auth deep dives: Advanced → [mcporter](/advanced/3-mcporter), [authentication](/advanced/4-authentication)

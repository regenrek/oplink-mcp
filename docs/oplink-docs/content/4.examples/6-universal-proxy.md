---
title: Universal Proxy (Multi‑Server Auto‑Discovery)
description: Call any tool from multiple MCP servers through one Oplink workflow
---

This example demonstrates how Oplink + mcporter let you call any tool from any registered MCP server, with tool discovery handled automatically. It mixes an stdio server and an HTTP server to showcase both transports.

## What it shows

- Multiple `externalServers` in one workflow
- Auto‑discovery via `describe_tools({ "workflow": "universal_helper" })`
- Cross‑server composition in a scripted workflow

## Files

- `examples/universal-proxy-demo/.mcp-workflows/servers.json`
- `examples/universal-proxy-demo/.mcp-workflows/workflows.yaml`

## Servers

- `chrome-devtools` (stdio): launched with `npx chrome-devtools-mcp@latest`
- `deepwiki` (HTTP SSE): `https://mcp.deepwiki.com/sse`

## Core workflow

```yaml
universal_helper:
  description: "Proxy Chrome DevTools + DeepWiki MCP tools via auto‑discovery"
  prompt: |
    You expose all tools discovered from the listed external MCP servers.
    Accept a JSON object with the fields:
      - tool: the tool name to run (e.g., chrome-devtools:take_screenshot or deepwiki:deepwiki_search)
      - server (optional): the alias to use when tool is not prefixed
      - args (optional): arguments for the tool call
    Use describe_tools({ "workflow": "universal_helper" }) to discover available tools.
  externalServers:
    - chrome-devtools
    - deepwiki
```

## Run

```bash
pnpm -r --filter ./packages/oplink dev -- --config examples/universal-proxy-demo/.mcp-workflows
```

Connect your MCP client to the running Oplink server.

## Discover tools

```json
describe_tools({ "workflow": "universal_helper" })
```

## Call tools

```json
universal_helper({
  "tool": "chrome-devtools:take_screenshot",
  "args": { "url": "https://example.com", "format": "png" }
})
```

```json
universal_helper({
  "server": "deepwiki",
  "tool": "deepwiki_search",
  "args": { "query": "Model Context Protocol" }
})
```

## Scripted composition

```yaml
screenshot_and_lookup:
  description: "Take a screenshot and then query DeepWiki"
  runtime: scripted
  parameters:
    url: { type: string, required: true }
    query: { type: string, required: true }
  steps:
    - call: chrome-devtools:navigate_page
      args: { type: url, url: "{{ url }}" }
    - call: chrome-devtools:take_screenshot
      args: { format: "png", fullPage: true }
    - call: deepwiki:deepwiki_search
      args: { query: "{{ query }}" }
```

That’s it — mcporter handles discovery, transport, and execution behind the scenes, and Oplink proxies everything through one workflow.


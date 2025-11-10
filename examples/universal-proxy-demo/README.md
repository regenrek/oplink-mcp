# Universal Proxy Demo (Auto‑Discovery, Multiple Servers)

This example shows how a single Oplink workflow can proxy multiple external MCP servers and discover their tools automatically via mcporter. You can call any tool exposed by the servers you declare in `.mcp-workflows/servers.json` — Oplink + mcporter will launch/connect and run it for you.

## What’s included

- Two external servers, different transports:
  - `chrome-devtools` (stdio) — launched via `npx chrome-devtools-mcp@latest`
  - `deepwiki` (HTTP SSE) — public endpoint, no auth
- One auto‑discovery workflow `universal_helper` exposing all tools from both servers
- One scripted example `screenshot_and_lookup` composing tools across servers

## Prerequisites

- Node.js and `pnpm`
- Chrome/Chromium installed (for Chrome DevTools MCP)

## Run Oplink MCP server

Using the repo workspace build:

```bash
pnpm -r --filter ./packages/oplink dev -- --config examples/universal-proxy-demo/.mcp-workflows
```

Or using the published CLI (if installed globally/locally):

```bash
npx oplink server --config examples/universal-proxy-demo/.mcp-workflows
```

Then connect your MCP‑compatible client (Cursor, Claude Desktop, etc.) to the running Oplink stdio server.

## Discover tools

Ask the built‑in helper to list tools available to this workflow:

```json
describe_tools({ "workflow": "universal_helper" })
```

## Call any tool from any server

Call by fully‑qualified name `alias:tool` or provide `server` separately:

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

## Scripted composition example

```json
screenshot_and_lookup({
  "url": "https://example.com",
  "query": "example domain"
})
```

## How it works

Declare servers in `.mcp-workflows/servers.json`. Oplink hands off launch/transport, discovery, and schema validation to mcporter. When you invoke a tool, Oplink forwards it to mcporter, which connects (stdio or HTTP) and executes the tool. No duplication of tool schemas in your repo is required.


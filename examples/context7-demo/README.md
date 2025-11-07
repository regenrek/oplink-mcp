# Context7 Demo Config

This folder shows how to wire Upstash Context7 into Oplink via the new MCP registry.

## Files

- `.mcp-workflows/servers.json` – declares the `context7` alias using the published `@upstash/context7-mcp` stdio command. The `${CONTEXT7_API_KEY}` placeholder is expanded at startup, so export that env var before running.
- `.mcp-workflows/workflows.yaml` – defines two workflows:
  - `context7_demo`: uses an explicit proxy tool `context7:get-library-docs`.
  - `context7_auto`: uses `externalServers: [context7]` to auto-register all Context7 tools while still hinting that `context7:get-library-docs` is preferred.

## Usage

1. Grab an API key from [https://context7.upstash.io](https://context7.upstash.io) and export it:
   ```bash
   export CONTEXT7_API_KEY="sk-..."
   ```
2. Start Oplink against this config:
   ```bash
   pnpm -r --filter ./packages/oplink dev -- --config examples/context7-demo/.mcp-workflows
   ```
3. In your MCP client (Cursor, Claude, etc.), connect to the running Oplink server, list tools, and invoke either `context7_demo` or the proxy tool `context7:get-library-docs` directly.

If `CONTEXT7_API_KEY` is missing or invalid, Oplink will fail fast during startup, ensuring there are no silent fallbacks.

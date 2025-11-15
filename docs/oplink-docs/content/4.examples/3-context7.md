---
title: Context7 Integration
description: Integrate Upstash Context7 for library documentation lookup
---

This example shows how to wire Upstash Context7 into Oplink via the MCP registry.

## Prerequisites

Get an API key from [https://context7.upstash.io](https://context7.upstash.io).

## Configuration

### Environment Variables

```bash
export CONTEXT7_API_KEY="sk-..."
```

### Server Configuration

- `.mcp-workflows/servers.json` – declares the `context7` alias using the published `@upstash/context7-mcp` stdio command. The `${CONTEXT7_API_KEY}` placeholder is expanded at startup.

- `.mcp-workflows/workflows.yaml` – defines two workflows:
  - `context7_demo`: prompt workflow that exposes Context7 tools via `externalServers`
  - `context7_auto`: auto-discovery workflow that exposes all Context7 tools

## Workflows

### `context7_demo`

Prompt workflow that exposes Context7 tools:

```yaml
context7_demo:
  description: "Answer documentation questions via Context7"
  parameters:
    topic:
      type: "string"
      description: "Library or topic to research"
      required: true
  prompt: |
    Use context7:get-library-docs with the topic {{ topic }}.
    Summarize the most relevant APIs and callouts for the user.
  externalServers:
    - context7
```

### `context7_auto`

Auto-discovery workflow:

```yaml
context7_auto:
  description: "Auto-discovered Context7 tools"
  prompt: |
    Use Context7 tools as needed to collect documentation and answer the request.
  externalServers:
    - context7
```

## Usage

1. **Export the API key:**
   ```bash
   export CONTEXT7_API_KEY="sk-..."
   ```

2. **Start Oplink:**
   ```bash
   pnpm -r --filter ./packages/oplink dev -- --config examples/context7-demo/.mcp-workflows
   ```

3. **In your MCP client:**
   - Connect to the running Oplink server
   - List tools to see available workflows
   - Invoke either `context7_demo` or the proxy tool `context7:get-library-docs` directly

## Example

```json
context7_demo({
  "topic": "react hooks"
})
```

If `CONTEXT7_API_KEY` is missing or invalid, Oplink will fail fast during startup, ensuring there are no silent fallbacks.


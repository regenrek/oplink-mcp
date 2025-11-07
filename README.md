# Oplink

![Oplink Logo](public/oplink.png)


Create your own no-code workflows with MCP apps. Oplink combines multiple MCP servers into unified workflows that you define in simple YAML files.

✨ **Why Oplink?**
<br /><br />
🚀 *No-code agent workflows* — create your own agent workflows with just editing yaml files<br />
🧩 *One endpoint, many servers* — bundle any MCP Server like Chrome DevTools, shadcn, Context7, etc. behind a single MCP server entry.<br />
🛡️ *Guided prompts & schemas* — every workflow exposes typed parameters, instructions, and curated helper tools.<br />
🧠 *Works in any MCP client* — Cursor, Claude Code, Codex, Windsurf, and friends can run complex flows without custom glue code.<br /><br />

Imagine you're debugging a frontend issue and need to:
- **Chrome DevTools** to inspect the browser, capture screenshots, and analyze network requests
- **shadcn** to understand component APIs and get the latest library documentation

![Example](public/workflow.jpg)

Without Oplink, you'd need to manually coordinate between multiple MCP servers, switching contexts and piecing together results. With Oplink, you define a single `frontend_debugging` workflow that orchestrates both servers in one call.

## Overview

Oplink transforms YAML-based workflow definitions into executable MCP tools. Unlike tools that only reference tool names in prompts, Oplink can actually execute external MCP tools that you wire in via a lightweight registry (`.mcp-workflows/servers.json`).

**Oplink combines multiple MCP servers into unified workflows.** Define prompts and tool sequences in YAML, wire in external MCP servers via a simple registry, and expose everything as a single MCP tool that works in any MCP client (Cursor, Claude, Windsurf, etc.).

### Example: Frontend Debugging Workflow

```yaml
frontend_debugging:
  description: "Debug frontend issues using Chrome DevTools and shadcn components"
  prompt: |
    Analyze the reported issue systematically.
    Use Chrome DevTools to inspect the browser state and capture diagnostics.
    Reference shadcn component documentation to understand the UI library.
  tools: "chrome-devtools:take_screenshot, chrome-devtools:list_console_messages, shadcn:search_items_in_registries"
```

One workflow, multiple servers, seamless execution. That's why Oplink exists.

## Installation

```bash
npx -y oplink@latest init
```

### Cursor Configuration

```json
{
  "mcpServers": {
    "oplink-get-docs": {
      "command": "npx",
      "args": [
        "oplink@latest",
        "server",
        "--config",
        "examples/deepwiki-demo/.mcp-workflows"
      ]
    },
    "oplink-frontend-debugging": {
      "command": "npx",
      "args": [
        "oplink@latest",
        "server",
        "--config",
        "examples/frontend-mcp-demo/.mcp-workflows"
      ],
      "env": {
        "FRONTEND_ROOT": "/path/to/oplink/examples/frontend-mcp-demo"
      }
    }
  }
}
```

### Custom Configuration

```json
{
  "mcpServers": {
    "oplink": {
      "command": "npx",
      "args": [
        "oplink@latest",
        "server",
        "--config",
        "/path/to/.workflows",
        "--preset",
        "thinking,coding"
      ]
    }
  }
}
```

## Configuration

Create a `.workflows` or `.mcp-workflows` directory and add YAML workflow files:

```yaml
debug_workflow:
  description: "Debug application issues"
  prompt: |
    Analyze the issue systematically.
    Gather logs and error information.
  toolMode: "situational"
  tools: "analyzeLogs, checkErrors, validateConfig"
```

### MCP Server Registry

External tools are resolved through `.mcp-workflows/servers.json`. Each entry maps a friendly alias to an MCP server definition (stdio command or HTTP endpoint). Use `${ENV_VAR}` placeholders for secrets. Oplink reads this file directly; you do not need a `mcporter.json` for Oplink to run.

```json
{
  "servers": {
    "context7": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": { "CONTEXT7_TOKEN": "${CONTEXT7_TOKEN}" }
    },
    "grafana": {
      "type": "http",
      "url": "https://grafana.example.com/mcp",
      "headers": { "Authorization": "Bearer ${GRAFANA_TOKEN}" }
    }
  }
}
```

The alias (`context7`, `grafana`, etc.) becomes the `server` prefix in `server:tool` names and in the `externalServers` array. Startup fails if an alias referenced in your workflows is missing, the registry is malformed, or an environment placeholder cannot be resolved.

See `examples/context7-demo/` (Context7) and `examples/deepwiki-demo/` (DeepWiki) for ready-to-run setups that wire real MCP servers into Oplink via this registry + workflow pair.

### External Server Integration

Reference tools from external servers using `server:tool` format (aliases come from `servers.json`):

```yaml
dev_workflow:
  description: "Development workflow"
  prompt: "Use available tools to complete the task"
  tools: filesystem:read_file, filesystem:write_file, github:create_issue
```

Auto-discover all tools from external servers:

```yaml
production_workflow:
  description: "Production incident response"
  prompt: "Investigate and resolve the incident"
  externalServers:
    - filesystem
    - github
    - monitoring
  tools: analyzeCode  # Can mix with manual references
```

### Workflow Scope vs Tool Exposure

- If you use `externalServers`, Oplink will auto-register the entire tool catalog from those servers (useful for broad integrations like DeepWiki).
- To keep the tool list small, declare only the proxies you need at the top level and reference them from workflows. Example (Chrome DevTools subset used by the frontend demo):

```yaml
chrome-devtools:navigate_page:
  description: "Navigate pages (url/back/forward/reload)"
chrome-devtools:performance_start_trace:
  description: "Start a performance trace"
chrome-devtools:performance_stop_trace:
  description: "Stop the performance trace"
chrome-devtools:list_network_requests:
  description: "List recent network requests"
chrome-devtools:list_console_messages:
  description: "List console logs"
chrome-devtools:take_screenshot:
  description: "Capture a screenshot"
```

Then reference those names in your workflow `tools:` list.

### Sequential vs Situational Tools

**Situational (default)**: Tools used as needed
```yaml
workflow:
  toolMode: "situational"
  tools: "tool1, tool2, tool3"
```

**Sequential**: Tools executed in order
```yaml
workflow:
  toolMode: "sequential"
  tools: "tool1, tool2, tool3"
```

### Parameter Injection

Inject typed parameters into prompts:

```yaml
thinking_mode:
  description: "Reflect on thoughts"
  parameters:
    thought:
      type: "string"
      description: "The thought to reflect upon"
      required: true
    context:
      type: "string"
      description: "Additional context"
  prompt: |
    Deeply reflect upon: {{ thought }}
    Consider this context: {{ context }}
    Analyze implications and tradeoffs.
```

### Advanced Tool Configuration

Define tool-specific prompts and optional flags:

```yaml
analysis_workflow:
  description: "Comprehensive analysis"
  prompt: "Begin analysis"
  toolMode: "sequential"
  tools:
    gather_data: "Collect relevant information"
    analyze_data:
      prompt: "Perform deep analysis"
      optional: false
    generate_report:
      prompt: "Create summary report"
      optional: true
```

## Preset Workflows

### Thinking

- **Thinking Mode**: Structured reflection and analysis
- **Deep Thinking Mode**: Multi-perspective comprehensive analysis

### Coding

- **Debugger Mode**: Systematic debugging with hypothesis testing
- **Architecture Mode**: System design with tradeoff analysis
- **Planner Mode**: Code change planning with codebase analysis
- **PRD Mode**: Product requirements documentation
- **Save Note**: Progress tracking and documentation

### GitHub

- **PR Review Mode**: Comprehensive pull request analysis
- **PR Creation Mode**: Structured PR creation workflow
- **Create Branch**: Contextual branch naming
- **Save Changes**: Git commit and push workflow

## External Tool Integration

Oplink uses mcporter under the hood to connect to external MCP servers, but it reads the registry from `.mcp-workflows/servers.json` in your chosen `--config` directory.
1. Define servers in `.mcp-workflows/servers.json` (see the examples above)
2. Reference tools as `server:tool` in workflow configs
3. Oplink registers only the tools you specify (or all, if you use `externalServers`)

**Tool Call Flow:**
```
MCP Client → Oplink → mcporter Runtime → External MCP Server → Result
```

Tools are discovered at startup and registered with the `server:tool` naming convention. External tools use their original `inputSchema` from the source server.

## Requirements

- Node.js 18+ or 20+
- Optional: mcporter CLI for local inspection (`npx mcporter list <alias>`)
- MCP client (Cursor, Claude Desktop, etc.)

## Troubleshooting

- Missing `FRONTEND_ROOT` (shadcn): set `export FRONTEND_ROOT=$(pwd)/examples/frontend-mcp-demo` or set it under your MCP client entry's `env` block.
- Chrome won’t launch: ensure Chrome is installed and starts locally. For remote/debugging Chrome, launch it separately and update the Chrome DevTools server flags per its docs.
- No tools appear: confirm `--config` points to the intended `.mcp-workflows` directory and your IDE picked up the MCP server entry.

## Development

```bash
# Install dependencies
pnpm install

# Build packages
pnpm build

# Run tests
pnpm test

# Start development server
cd packages/oplink
pnpm dev
```

## Definition

Oplink is an MCP server that orchestrates workflows by combining prompts with external MCP tool execution. It bridges your workflow definitions with mcporter-configured MCP servers, enabling automatic tool discovery and execution.

## Credits

- Initial idea inspired by [mcpn](https://github.com/regenrek/mcpn), developed in collaboration with [@tedjames](https://github.com/tedjames)
- Using [mcporter](https://github.com/steipete/mcporter) code-generation toolkit for mcp by [@steipete](https://github.com/steipete)

## License

MIT

## Repository

https://github.com/instructa/oplink

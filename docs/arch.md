# Oplink Architecture (Mermaid)

The diagram illustrates how a workflow runs end‑to‑end: an IDE (MCP client) invokes an Oplink workflow (prompt + schema), the Oplink tool orchestrator executes local/proxy tools, and mcporter bridges calls to external MCP servers (Chrome DevTools, shadcn, DeepWiki, etc.). Results stream back to Oplink, which aggregates and returns a response to the client.

```mermaid
flowchart LR
  %% Groups
  subgraph IDE[Client]
    A[MCP Client (IDE)
Cursor / Claude / Windsurf]
  end

  subgraph O[Oplink MCP Server]
    O1[Tool Orchestrator
(Workflows runtime)]
    O2[(Workflows YAML
workflows.yaml)]
    O3[(Server Registry
.mcp-workflows/servers.json)]
  end

  subgraph M[mcporter Runtime]
    M1[createRuntime() / listTools() / callTool()]
  end

  subgraph X[External MCP Servers]
    X1[chrome-devtools
(stdio)]
    X2[shadcn
(stdio)]
    X3[deepwiki
(http or stdio)]
  end

  %% Invocation path
  A -- invoke workflow + params --> O1
  O1 --- O2
  O1 --- O3

  %% Startup discovery/registration
  O1 -. validate available tools .-> M1
  M1 -. reads servers.json, expands env, launches stdio/http .-> X1
  M1 -. likewise .-> X2
  M1 -. likewise .-> X3

  %% Execution path
  O1 -- proxy tool call --> M1
  M1 -- execute --> X1
  X1 -- result --> M1
  M1 -- structuredContent / files / text --> O1
  O1 -- aggregated response --> A

  %% Notes
  classDef note fill:#f6f8fa,stroke:#d0d7de,color:#24292f;
  N1["Explicit proxies keep tool list small\n(e.g., chrome-devtools:take_screenshot).\nUsing externalServers auto-registers full catalogs."]:::note
  N2["mcporter handles discovery, auth, stdio/http transport,\nretries, and connection reuse."]:::note
  O1 --- N1
  M1 --- N2
```

## Execution Steps

1. The MCP client invokes an Oplink workflow with parameters.
2. Oplink loads workflow definitions and the external server registry in the selected `--config` directory.
3. At startup, Oplink validates/ registers only the tools you declare (or all, if `externalServers` is used).
4. When the prompt calls a tool, Oplink forwards the request to mcporter.
5. mcporter launches/connects to the external MCP server and executes the tool.
6. Results stream back to Oplink, which aggregates them and returns the final response to the MCP client.


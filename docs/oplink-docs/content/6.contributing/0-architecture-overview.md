---
title: Architecture Overview
description: High‑level architecture for contributors
---

This page gives contributors a quick mental model of how Oplink fits together. For the full diagram, see docs/arch.md in the repo.

## Big Picture

- IDE (MCP client) connects to the Oplink stdio server.
- Oplink loads workflows from `.mcp-workflows/workflows.yaml` and external servers from `.mcp-workflows/servers.json`.
- `.env` in the same folder is auto‑loaded and passed to external processes (e.g., Docker `-e VAR`).
- Oplink orchestrates tool calls; `mcporter` handles discovery/auth/transport to external MCP servers.

```text
IDE → Oplink (workflows + registry + .env) → mcporter → external MCP servers → Oplink → IDE
```

## Authoring Model

- Three workflow shapes (runtime optional; schema enforces shapes):
  - Scripted: requires `steps`, disallows `externalServers`.
  - External: requires `externalServers` + `prompt`, disallows `steps`.
  - Prompt‑only: requires `prompt`, disallows `steps`/`externalServers`.
- Step keys: `call`, `args`, `saveAs`, `requires`, `quiet`.

## One Source of Truth

- Keep external server definitions in `.mcp-workflows/servers.json` only.
- IDE configs (.cursor/mcp.json, etc.) should point only to Oplink — don’t duplicate external servers in IDE files.

## Env & Examples (Atlassian)

- Cloud: `JIRA_USERNAME` + `JIRA_API_TOKEN` (and Confluence equivalents).
- Server/Data Center: `JIRA_PERSONAL_TOKEN` (and `CONFLUENCE_PERSONAL_TOKEN`), optional `*_SSL_VERIFY=false`.
- Place `.env` inside the `--config` directory so Oplink auto‑loads it and passes env to the container.

## Errors & Suggestions

- Unknown tool names include "Did you mean …" suggestions based on the live catalog.
- External call failures include alias:tool and step info (for scripted flows).

## Reproducibility (Planned)

- Catalog lockfile and `oplink doctor/verify` will make large registries reproducible and debuggable.

See also: repo file `docs/arch.md` for the Mermaid diagram and more detail.

## Mermaid Diagram

```mermaid
flowchart LR
  %% Groups
  subgraph IDE[Client]
    A[MCP Client]
  end

  subgraph O[Oplink MCP Server]
    O1[Tool Orchestrator]
    O2[Workflows YAML / workflows.yaml]
    O3[Server Registry / .mcp-workflows/servers.json + .env]
  end

  subgraph M[mcporter Runtime]
    M1[mcporter runtime]
  end

  subgraph X[External MCP Servers]
    X1[chrome-devtools stdio]
    X2[shadcn stdio]
    X3[deepwiki http-or-stdio]
  end

  %% Invocation path
  A --> O1
  O1 --- O2
  O1 --- O3

  %% Startup discovery/registration
  O1 -.-> M1
  M1 -.-> X1
  M1 -.-> X2
  M1 -.-> X3

  %% Execution path
  O1 --> M1
  M1 --> X1
  X1 --> M1
  M1 --> O1
  O1 --> A

  %% Notes
  classDef note fill:#f6f8fa,stroke:#d0d7de,color:#24292f;
  N1[Only workflow tools are exposed to the MCP client; helper tools stay internal.]:::note
  N2[mcporter handles discovery, auth, stdio/http transport, retries, and connection reuse.]:::note
  N3[.env is auto‑loaded from the --config directory and passed to external servers (e.g., Docker -e).]:::note
  O1 --- N1
  M1 --- N2
  O3 --- N3
```

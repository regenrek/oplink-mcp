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

## Architecture Diagram

![Oplink Architecture Diagram](/architecture-diagram.svg)

**Notes:**
- Only workflow tools are exposed to the MCP client; helper tools stay internal.
- mcporter handles discovery, auth, stdio/http transport, retries, and connection reuse.
- `.env` is auto‑loaded from the `--config` directory and passed to external servers (e.g., Docker `-e`).

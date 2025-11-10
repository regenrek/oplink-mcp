# Plan: Oplink Workflows – Clean, Explicit YAML Schema (Long‑Term)

Status: draft
Owner: Oplink Core
Scope: schema/, docs/, examples/, CLI validate
Principles: Early development, no users; do it right; zero tech debt; no compatibility shims.

## Goals
- Remove editor warnings (e.g., “Missing property 'steps'”).
- Make the three workflow styles explicit and mutually exclusive:
  1. Scripted (multi‑step)
  2. External (helper exposing external servers)
  3. Prompt‑only (single prompt tool)
- Keep `runtime` optional for authors, but structurally inferable by editors.
- Align field names with code; avoid snake/camel mismatches.
- Provide strict, self‑documenting shapes; no shims.

## Design

### Three Explicit Shapes (runtime optional)
Replace the current single bag‑of‑properties + if/then with a `oneOf` of three clean shapes. Editors (YAML LS) will stop guessing and won’t complain about `steps` for external/prompt tools.

- ScriptedWorkflow
  - required: `steps`
  - optional: `description`, `parameters`, `tools`, `toolMode`, `context`, `prompt`
  - disallow: `externalServers`
  - `runtime`: omitted or `"scripted"`
  - `steps[]` required: `call`
  - `steps[]` properties: `call`, `args`, `saveAs`, `requires`, `quiet`
  - `additionalProperties`: false

- ExternalWorkflow
  - required: `externalServers` (min 1), `prompt`
  - optional: `description`, `parameters`, `tools`, `toolMode`, `context`
  - disallow: `steps`
  - `runtime`: omitted or `"external"`
  - `additionalProperties`: false

- PromptWorkflow
  - required: `prompt`
  - optional: `description`, `parameters`, `tools`, `toolMode`, `context`
  - disallow: `steps`, `externalServers`
  - `runtime`: omitted or `"prompt"`
  - `additionalProperties`: false

### Field Naming Alignment
- Use camelCase throughout; align with server implementation:
  - `save_as` → `saveAs`
  - Keep `args`, `requires`, `quiet`, `externalServers`, `parameters`.

### Strictness & Mutual Exclusivity
- Enforce exclusivity via `oneOf` shapes; remove the current `allOf if/then` hints.
- `additionalProperties: false` per shape to keep configs clean.

## Schema Structure
- File: `schema/oplink-workflows.schema.json`
- `$defs` (or `definitions`) for:
  - `Parameter` (existing)
  - `Step` (call, args, saveAs, requires, quiet)
  - `ScriptedWorkflow`, `ExternalWorkflow`, `PromptWorkflow`
- Top level: `patternProperties`: `".*"` → `oneOf` the three shapes.
- Consider bumping `$id` to a v2 URL, but we can keep the filename stable. Examples will point to the updated file.

## Docs & Scaffolds
- Update examples and docs to show the three shapes with minimal templates.
- Recommend (not require) setting `runtime` explicitly in examples for better IDE hints.
- Update Atlassian example helpers to `runtime: external`.

## CLI Validation
- Keep AJV for schema validation; enhance `oplink validate` messages:
  - “This looks like a scripted workflow but is missing `steps`.”
  - “External workflows require `prompt` and `externalServers`.”
  - “Prompt‑only workflows must not define `steps` or `externalServers`.”

## Examples Migration
- Replace `save_as` → `saveAs` across examples and test configs.
- Add `runtime: external` to helper workflows in examples (e.g., Jira/Confluence helpers).

## Testing
- AJV compile tests for:
  - Valid scripted/external/prompt workflows
  - Invalid combos (both `steps` and `externalServers`, missing `prompt` in external, etc.)
- CLI validate tests for human‑friendly errors.
- Editor smoke test with YAML LS (VSCode) to confirm warnings disappear for valid shapes.

## Versioning & Rollout
- Early dev: we can land the breaking rename (`save_as` → `saveAs`) now.
- Update the YAML modeline in examples to point at the updated schema file.
- No shims; examples and docs update in lockstep.

## Acceptance Criteria
- Opening any example YAML in VSCode/YAML LS produces zero schema warnings.
- `oplink validate` prints clear, shape‑specific errors for invalid cases.
- Server runtime inference remains unchanged; `runtime` stays optional.
- All examples updated; no snake/camel mismatches remain.

## Risks & Mitigations
- Editor schema cache: document how to reload window if needed.
- Stricter shapes flag early mistakes: desired in early dev; provide clear messages and templates.

## Deliverables
- [ ] Rewrite schema with `oneOf` shapes and `$defs` for Step/Parameter
- [ ] Update examples: `save_as` → `saveAs`, add `runtime: external` to helpers
- [ ] Update docs to show the three shapes and add authoring guidance
- [ ] Enhance CLI validation messages
- [ ] Add AJV + CLI tests

---

## Examples (short, editor‑friendly)

Below are three minimal examples that align with the planned shapes. `runtime` is optional; it’s included here to make intent obvious to editors.

### 1) Scripted Workflow (multi‑step)

```yaml
summarize_issue:
  description: "Fetch an issue and summarize key fields"
  runtime: scripted
  parameters:
    issue_key:
      type: string
      required: true
  steps:
    - call: atlassian:jira_get_issue
      saveAs: issue
      args:
        issue_key: "{{ issue_key }}"
    - call: local:compose_summary
      args:
        key: "{{ issue.key }}"
        summary: "{{ issue.fields.summary }}"
        status: "{{ issue.fields.status.name }}"
```

Capabilities shown: parameters, multi‑step execution, `saveAs` reuse, mixing external + local tools.

### 2) External Workflow (helper exposing external tools)

```yaml
jira_helper:
  description: "Access Jira MCP tools via the 'atlassian' alias"
  runtime: external
  prompt: |
    Start with:
    describe_tools({ "workflow": "jira_helper" })
    Then call jira_helper({ "tool": "atlassian:jira_search", "args": { "jql": "assignee = currentUser()" } })
  externalServers:
    - atlassian
```

Capabilities shown: helper that surfaces all tools from an external alias, explicit runtime, guided prompt.

### 3) Prompt‑only Workflow (single tool with structured params)

```yaml
explain_regex:
  description: "Explain and test a regular expression against input"
  runtime: prompt
  parameters:
    pattern:
      type: string
      required: true
    input:
      type: string
      required: true
  prompt: |
    Explain what this regex does and test it against the input.
    Pattern: {{ pattern }}
    Input:   {{ input }}
    Return matches, pitfalls, and safer alternatives if applicable.
```

Capabilities shown: typed parameters, pure prompt workflow with no steps nor external servers.

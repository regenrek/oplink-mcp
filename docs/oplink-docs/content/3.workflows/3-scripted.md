---
title: Scripted Workflows
description: Validate inputs and orchestrate multi‑step flows that call external MCP tools
---

Scripted workflows define parameters and a sequence of `steps` that call external tools. Oplink validates inputs, renders args from a template context, executes tools, and aggregates results.

Minimal example

```yaml
take_screenshot:
  description: "Capture a page"
  runtime: scripted
  parameters:
    url:
      type: string
      required: true
    format:
      type: string
      enum: [png, jpeg, webp]
      default: png
  steps:
    - call: chrome-devtools:navigate_page
      args:
        type: url
        url: "{{ url }}"
    - call: chrome-devtools:take_screenshot
      args:
        fullPage: true
        format: "{{ format }}"
```

Common step keys

- `call` – `alias:tool_name` for an external tool
- `args` – object; supports mustache templating with the current context
- `save_as` – store the tool result to reuse later (e.g., `save_as: issue`)
- `requires` – only run a step if a context key exists
- `quiet` – suppress per‑step log lines in the aggregated output

Parameter handling

- YAML parameters map to runtime validation (Zod). Types: `string`, `number`, `boolean`, `array`, `object`, and `enum`.
- Required/optional and defaults are enforced before steps run.
- Rendered args use the context from parameters and any prior `save_as` values.
- Type‑preserving args:
  - If an arg is exactly a single placeholder like `"{{ limit }}"`, Oplink injects the underlying value with its original type (number/boolean/array/object).
  - If an arg contains mixed text (e.g., `"page={{ limit }}"`), the result is a string. Pure numeric/boolean strings (`"20"`, `"true"`) are coerced to numbers/booleans when the whole value is just the placeholder.

Why scripted

- Curate defaults and required knobs missing from upstream schemas
- Encapsulate complex flows into one simple tool for your IDE
- Chain tools across multiple servers reliably

See also

- Advanced: [Scripted Workflow Arguments](/5.advanced/2-scripted-workflow-args) for additional patterns
- [Parameters & Schemas](./5-parameters-and-schemas)

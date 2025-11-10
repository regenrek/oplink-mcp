---
title: Parameters & Schemas
description: Defining workflow parameters and mapping to runtime validation
---

Workflow `parameters` are validated at runtime and injected into prompts/args.

Example

```yaml
custom_mode:
  description: "Workflow with parameter injection"
  parameters:
    thought:
      type: string
      description: "A thought to reflect upon"
      required: true
  prompt: |
    Deeply reflect upon the provided thought: {{ thought }}
```

Notes

- Supported types: `string`, `number`, `boolean`, `array`, `object`, and `enum`.
- Required/optional and defaults are enforced before any steps run.
- Rendered values (e.g., `{{ thought }}`) are available to your prompt and to step `args`.
- Type preservation for step args:
  - If an arg is exactly `{{ param }}`, the original value and type are injected (numbers stay numbers; booleans stay booleans; arrays/objects remain structured).
  - If an arg mixes text with placeholders, the final value is a string.

Scripted workflows

- Parameter schema → Zod validator; upstream tool JSON Schemas are also used to validate step `args`.
- Save intermediate results with `save_as` and reference them in later steps.

See also

- [Scripted Workflows](./3-scripted)

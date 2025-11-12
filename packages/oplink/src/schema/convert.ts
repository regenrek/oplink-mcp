export type JSONSchema = Record<string, unknown>;

export function normalizeExternalSchema(raw: JSONSchema): JSONSchema {
  const out = structuredClone(raw);
  if (typeof out["$schema"] !== "string") {
    out["$schema"] = "https://json-schema.org/draft/2020-12/schema";
  }
  if (!out["type"] && !out["oneOf"] && !out["anyOf"] && !out["allOf"] && !out["$ref"]) {
    out["type"] = "object";
    (out as any).properties = (out as any).properties ?? {};
  }
  return out;
}

function normalizeTo202012(raw: JSONSchema, defName: string): JSONSchema {
  const forced = structuredClone(raw);
  forced["$schema"] = "https://json-schema.org/draft/2020-12/schema";
  const ref = forced["$ref"];
  const $defs = forced["$defs"] as Record<string, unknown> | undefined;
  if (typeof ref === "string" && ref.startsWith("#/$defs/") && $defs && $defs[defName]) {
    const resolved = structuredClone($defs[defName]) as JSONSchema;
    resolved["$schema"] = forced["$schema"];
    if (!resolved["type"] && !resolved["oneOf"] && !resolved["anyOf"] && !resolved["allOf"]) {
      resolved["type"] = "object";
      (resolved as any).properties = (resolved as any).properties ?? {};
    }
    return resolved;
  }
  if (!forced["type"] && !forced["oneOf"] && !forced["anyOf"] && !forced["allOf"]) {
    forced["type"] = "object";
    (forced as any).properties = (forced as any).properties ?? {};
  }
  return forced;
}

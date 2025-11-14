import { beforeEach, describe, expect, it, vi } from "vitest";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { z } from "zod";

// Mock external tool discovery/execution to avoid network
const listToolsMock = vi.fn();
const executeExternalToolMock = vi.fn();

class MockExternalServerError extends Error {}

vi.mock("../src/external-tools", () => ({
  listExternalServerTools: listToolsMock,
  executeExternalTool: executeExternalToolMock,
  ExternalServerError: MockExternalServerError,
}));

const { registerToolsFromConfig } = await import("../src/server");

interface RegisteredTool {
  name: string;
  description?: string;
  schema?: any; // JSON Schema on wire
  handler: (params?: Record<string, unknown>) => Promise<any>;
}

function newAjv() {
  // Use relaxed settings for contract compile checks; runtime validation happens via Zod internally
  const ajv = new Ajv({ strict: false, allowUnionTypes: true, validateSchema: false, meta: false });
  addFormats(ajv);
  return ajv;
}

describe("MCP wire contract: JSON Schema on wire, Zod internal", () => {
  let registrations: RegisteredTool[];
  let server: { tool: (...args: any[]) => void };
  const ajv = newAjv();

  beforeEach(() => {
    registrations = [];
    listToolsMock.mockReset();
    executeExternalToolMock.mockReset();

    server = {
      tool: (name: string, ...rest: any[]) => {
        let description: string | undefined;
        let schema: any | undefined;
        let handler: (params?: Record<string, unknown>) => Promise<any>;

        if (typeof rest[0] === "string") description = rest.shift();
        if (rest.length === 2) schema = rest.shift();
        handler = rest[0];
        registrations.push({ name, description, schema, handler });
      },
    };
  });

  it("emits JSON Schema for prompt, scripted, and external tools; schemas compile with Ajv", async () => {
    // External alias returns one tool
    listToolsMock.mockResolvedValueOnce([
      {
        name: "ask_question",
        description: "Ask question",
        inputSchema: {
          type: "object",
          properties: {
            repoName: { type: "string" },
            question: { type: "string" },
          },
          required: ["repoName", "question"],
        },
      },
    ]);

    const config = {
      // Prompt workflow with parameters
      hello_prompt: {
        description: "Simple prompt",
        prompt: "Hello {{name}}",
        parameters: { name: { type: "string", required: true } },
      },
      // Scripted workflow that calls one external tool
      repo_q: {
        runtime: "scripted",
        description: "Ask repo question",
        parameters: { repo: { type: "string", required: true }, q: { type: "string", required: true } },
        steps: [{ call: "deepwiki:ask_question", args: { repoName: "{{ repo }}", question: "{{ q }}" } }],
      },
      // External router for the same alias
      deepwiki_auto: {
        prompt: "Use deepwiki",
        externalServers: ["deepwiki"],
      },
    } as Record<string, any>;

    await registerToolsFromConfig(server as any, config, { configDir: "/tmp/config" });

    // Ensure we registered all three
    const names = registrations.map((r) => r.name);
    expect(names).toContain("hello_prompt");
    expect(names).toContain("repo_q");
    expect(names).toContain("deepwiki_auto");

    // Validate schemas: present → compile and contain no Zod internals
    for (const r of registrations) {
      if (r.schema) {
        const json = JSON.stringify(r.schema);
        expect(json.includes("keyValidator")).toBe(false);
        expect(json.includes("_parse")).toBe(false);
        // Ajv should be able to compile all schemas we emit
        const validate = ajv.compile(r.schema);
        // Sanity check: valid minimal object for object schemas
        if (r.schema && r.schema.type === "object") {
          validate({});
        }
      }
    }

    // Scripted workflow should validate args internally and execute
    executeExternalToolMock.mockResolvedValueOnce({ content: [{ type: "text", text: "ok" }] });
    const scripted = registrations.find((r) => r.name === "repo_q")!;
    await expect(scripted.handler({ repo: "owner/repo", q: "what?" })).resolves.toBeDefined();
  });
});

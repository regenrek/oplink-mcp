import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

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
  schema?: Record<string, z.ZodTypeAny>;
  handler: (params?: Record<string, unknown>) => Promise<any>;
}

describe("typed template rendering in scripted args", () => {
  let registrations: RegisteredTool[];

  beforeEach(() => {
    registrations = [];
    listToolsMock.mockReset();
    executeExternalToolMock.mockReset();

    const server = {
      tool: (name: string, ...rest: any[]) => {
        let description: string | undefined;
        let schema: Record<string, z.ZodTypeAny> | undefined;
        let handler: (params?: Record<string, unknown>) => Promise<any>;

        if (typeof rest[0] === "string") {
          description = rest.shift();
        }
        if (rest.length === 2) {
          schema = rest.shift();
        }
        handler = rest[0];

        registrations.push({ name, description, schema, handler });
      },
    } as any;

    // Attach to closure for each test
    (global as any).__server = server;
  });

  it("preserves number, boolean, object and array types when placeholder is the entire value", async () => {
    listToolsMock.mockResolvedValueOnce([
      {
        name: "demo",
        description: "typed",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "number" },
            enabled: { type: "boolean" },
            filter: {
              type: "object",
              properties: { level: { type: "number" } },
            },
            tags: { type: "array", items: { type: "string" } },
          },
          required: ["limit", "enabled"],
        },
      },
    ]);

    executeExternalToolMock.mockResolvedValueOnce({ content: [] });

    const config = {
      demo_workflow: {
        runtime: "scripted",
        parameters: {
          limit: { type: "number", default: 10 },
          enabled: { type: "boolean", default: true },
          filter: {
            type: "object",
            properties: { level: { type: "number" } },
            default: { level: 2 },
          },
          tags: { type: "array", items: { type: "string" }, default: ["a", "b"] },
        },
        steps: [
          {
            call: "service:demo",
            args: {
              limit: "{{ limit }}",
              enabled: "{{ enabled }}",
              filter: "{{ filter }}",
              tags: "{{ tags }}",
            },
          },
        ],
      },
    } as const;

    const { registerToolsFromConfig } = await import("../src/server");
    await registerToolsFromConfig((global as any).__server, config as any, {
      configDir: "/tmp/config",
    });

    const tool = registrations.find((r) => r.name === "demo_workflow");
    expect(tool).toBeDefined();
    // Validate handler accepts parameters
    expect(z.object(tool!.schema!).parse({ limit: 5, enabled: false })).toMatchObject({ limit: 5, enabled: false });

    await tool!.handler?.({ limit: 25, enabled: false, filter: { level: 3 }, tags: ["x"] });
    expect(executeExternalToolMock).toHaveBeenCalledWith(
      "service",
      "demo",
      { limit: 25, enabled: false, filter: { level: 3 }, tags: ["x"] },
      "/tmp/config",
    );
  });

  it("coerces simple numeric/boolean strings for mixed templates but keeps mixed content as string", async () => {
    listToolsMock.mockResolvedValueOnce([
      {
        name: "demo2",
        description: "typed",
        inputSchema: {
          type: "object",
          properties: {
            page: { type: "number" },
            enabled: { type: "boolean" },
            note: { type: "string" },
          },
        },
      },
    ]);

    executeExternalToolMock.mockResolvedValueOnce({ content: [] });

    const config = {
      wf2: {
        runtime: "scripted",
        parameters: {
          p: { type: "number", default: 2 },
          b: { type: "boolean", default: true },
        },
        steps: [
          {
            call: "svc:demo2",
            args: {
              page: "{{ p }}",          // full placeholder → number
              enabled: "{{ b }}",       // full placeholder → boolean
              note: "p={{ p }}",        // mixed content → string
            },
          },
        ],
      },
    } as const;

    await registerToolsFromConfig((global as any).__server, config as any, {
      configDir: "/tmp/config",
    });

    const tool = registrations.find((r) => r.name === "wf2");
    await tool!.handler?.({});
    expect(executeExternalToolMock).toHaveBeenCalledWith(
      "svc",
      "demo2",
      { page: 2, enabled: true, note: "p=2" },
      "/tmp/config",
    );
  });
});


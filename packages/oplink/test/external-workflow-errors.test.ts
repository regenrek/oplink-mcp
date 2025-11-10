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

describe("external workflow error wrapping", () => {
  let registrations: RegisteredTool[];
  let server: { tool: (...args: any[]) => void };

  beforeEach(() => {
    registrations = [];
    listToolsMock.mockReset();
    executeExternalToolMock.mockReset();
    server = {
      tool: (name: string, ...rest: any[]) => {
        let description: string | undefined;
        let schema: Record<string, z.ZodTypeAny> | undefined;
        let handler: (params?: Record<string, unknown>) => Promise<any>;
        if (typeof rest[0] === "string") description = rest.shift();
        if (rest.length === 2) schema = rest.shift();
        handler = rest[0];
        registrations.push({ name, description, schema, handler });
      },
    } as any;
  });

  it("wraps runtime errors with alias:tool context", async () => {
    listToolsMock.mockResolvedValueOnce([
      {
        name: "jira_search",
        description: "Search",
        inputSchema: { type: "object", properties: { jql: { type: "string" } } },
      },
    ]);
    executeExternalToolMock.mockRejectedValueOnce(new Error("Error calling tool 'search'"));

    const config = {
      jira_helper: {
        description: "Auto",
        prompt: "List tools",
        externalServers: ["atlassian"],
      },
    } as const;

    await registerToolsFromConfig(server as any, config as any, { configDir: "/tmp/config" });
    const tool = registrations.find((r) => r.name === "jira_helper");
    const res = await tool!.handler({ tool: "atlassian:jira_search", args: { jql: "assignee = me()" } });
    const text = (res.content?.[0] as any)?.text ?? "";
    expect(text).toMatch(/Failed calling atlassian:jira_search: Error calling tool 'search'/);
  });
});


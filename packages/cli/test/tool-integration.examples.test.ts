import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { McpTestClient } from "@oplink/test-utils";
import * as fs from "fs";
import * as path from "path";
import { getModulePaths, ensureDirAndWriteYamlFile, createTestClient } from "./utils";

const { __dirname } = getModulePaths(import.meta.url);
const WF_DIR = path.join(__dirname, ".mcp-workflows-examples", ".mcp-workflows");

let client: McpTestClient;

beforeAll(async () => {
  if (!fs.existsSync(WF_DIR)) fs.mkdirSync(WF_DIR, { recursive: true });
  const examplesYaml = {
    test_calculator: {
      name: "calculator",
      description: "Perform mathematical calculations",
      parameters: {
        expression: { type: "string", description: "The mathematical expression to evaluate", required: true },
        precision: { type: "number", description: "Number of decimal places in the result", default: 2 },
      },
      prompt: "Evaluate the expression with the given precision.",
    },
  };
  ensureDirAndWriteYamlFile(path.join(WF_DIR, "workflows.yaml"), examplesYaml);

  client = createTestClient();
  await client.connectServer(["--config", WF_DIR]);
}, 15000);

afterAll(async () => { if (client) await client.close(); }, 15000);

describe("Parameterized Tool Integration Tests", () => {
  it("should list the parameterized tool", async () => {
    const tools = await client.listTools();
    console.log("Tools response structure:", JSON.stringify(tools, null, 2));

    expect(tools).toHaveProperty("tools");
    expect(Array.isArray(tools.tools)).toBe(true);

    const calculatorTool = tools.tools.find((tool: any) => tool.name === "calculator");
    expect(calculatorTool).toBeTruthy();
    expect(calculatorTool).toHaveProperty("description");
    expect(calculatorTool.description).toContain("calculation");
  }, 15000);

  it("should call the parameterized tool with arguments", async () => {
    const result = await client.callTool("calculator", { expression: "2 + 2", precision: 0 });
    console.log("Tool call result:", JSON.stringify(result, null, 2));

    expect(result).toHaveProperty("content");
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0]).toHaveProperty("type", "text");
    // integration tests depend on the tool actually succeeding now, not surfacing internal Zod errors
    expect(result.isError).toBeUndefined();
  }, 15000);
});

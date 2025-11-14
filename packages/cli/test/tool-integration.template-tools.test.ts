import { describe, it, beforeAll, afterAll, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { getModulePaths, createTestClient, ensureDirAndWriteYamlFile } from "./utils.js";

let client: any;
const { __dirname } = getModulePaths(import.meta.url);
const WF_DIR = path.join(__dirname, ".mcp-workflows-template", ".mcp-workflows");

beforeAll(async () => {
  if (!fs.existsSync(WF_DIR)) fs.mkdirSync(WF_DIR, { recursive: true });
  ensureDirAndWriteYamlFile(path.join(WF_DIR, "workflows.yaml"), {
    template_calculator: {
      name: "template_calculator",
      description: "Calculator with template parameters",
      parameters: {
        expression: { type: "string", description: "The mathematical expression to evaluate", required: true },
        precision: { type: "number", description: "Number of decimal places in the result", default: 2 },
      },
      prompt: "Calculate {{expression}} with {{precision}} decimal places precision.",
    },
  });
  client = createTestClient();
  await client.connectServer(["--config", WF_DIR]);
}, 15000);

afterAll(async () => { if (client) await client.close(); }, 15000);

describe("Template Parameter Integration Tests", () => {
  it("should list tools with template parameters", async () => {
    const tools = await client.listTools();

    const templateTool = tools.tools.find((tool: any) => tool.name === "template_calculator");
    expect(templateTool).toBeTruthy();
    expect(templateTool).toHaveProperty("description");
    expect(templateTool.description).toContain("template parameters");
  }, 15000);

  it("should call tools with template parameters", async () => {
    const result = await client.callTool("template_calculator", {
      expression: "5 * 10",
      precision: 0,
    });
    console.log("Tool call result:", JSON.stringify(result, null, 2));

    expect(result).toHaveProperty("content");
    expect(Array.isArray(result.content)).toBe(true);

    if (result.content[0]?.type === "text") {
      const responseText = result.content[0].text;
      expect(responseText).toContain("5 * 10");
      expect(responseText).toContain("0 decimal places");
    }
    expect(result.isError).toBeUndefined();
  }, 15000);
}); 

#!/usr/bin/env tsx
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

async function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const configDir = path.resolve(repoRoot, "examples/atlassian-demo/.mcp-workflows");
  const cliEntry = path.resolve(repoRoot, "packages/cli/bin/oplink.mjs");
  // Load example-level .env so the Atlassian server has required vars.
  const envFile = path.resolve(repoRoot, "examples/atlassian-demo/.env");
  try {
    const fs = await import("node:fs");
    if (fs.existsSync(envFile)) {
      const raw = fs.readFileSync(envFile, "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim();
        if (!process.env[key]) process.env[key] = value;
      }
    }
  } catch {}

  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");
  const client = new Client(
    { name: "verify-atlassian", version: "0.0.0" },
    { capabilities: { tools: { list: {}, call: {} }, prompts: {}, resources: {} } },
  );
  const transport = new StdioClientTransport({
    command: "node",
    args: [cliEntry, "server", "--config", configDir],
    env: { ...process.env },
    stderr: "inherit",
  });
  try {
    console.error("env JIRA_URL:", process.env.JIRA_URL || "<missing>");
    await client.connect(transport);
    // Ask Oplink to describe external tools for the atlassian alias and refresh cache
    const describe = await client.callTool({ name: "describe_tools", arguments: { workflow: "jira_helper", aliases: ["atlassian"], refresh: true } });

    const textItem = Array.isArray(describe?.content)
      ? describe.content.find((c: any) => c?.type === "text")
      : undefined;
    if (!textItem?.text) {
      throw new Error("describe_tools did not return a text payload");
    }
    const payload = JSON.parse(textItem.text);
    const toolsFromDescribe: string[] = (payload.workflows?.[0]?.aliases?.[0]?.tools || []).map((t: any) => t.name);

    const summary = {
      configDir,
      describe_count: toolsFromDescribe.length,
      describe: toolsFromDescribe,
    };
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await transport.close();
  }
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});

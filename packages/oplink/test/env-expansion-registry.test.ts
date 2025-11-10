import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ExternalServerError, loadExternalServerRegistry } from "../src/external/registry";

async function writeRegistry(tempDir: string, payload: unknown) {
  await fs.writeFile(path.join(tempDir, "servers.json"), JSON.stringify(payload, null, 2), "utf8");
}

describe("stdio env placeholder expansion (generic)", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "oplink-discord-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    delete process.env.DISCORD_BOT_TOKEN;
    delete process.env.API_TOKEN;
  });

  it("expands API_TOKEN into SERVER_TOKEN env", async () => {
    process.env.API_TOKEN = "api_secret";
    await writeRegistry(tempDir, {
      servers: {
        example: {
          type: "stdio",
          command: "npx",
          args: ["-y", "example-mcp"],
          env: {
            SERVER_TOKEN: "${API_TOKEN}",
          },
          description: "Example MCP server using stdio",
        },
      },
    });

    const registry = await loadExternalServerRegistry(tempDir);
    const def = registry.servers.get("example");
    expect(def).toBeDefined();
    expect(def?.command).toMatchObject({
      kind: "stdio",
      command: "npx",
      args: ["-y", "example-mcp"],
      cwd: tempDir,
    });
    expect(def?.env).toEqual({ SERVER_TOKEN: "api_secret" });
  });

  it("throws when required env is missing", async () => {
    await writeRegistry(tempDir, {
      servers: {
        example: {
          type: "stdio",
          command: "npx",
          args: ["-y", "example-mcp"],
          env: {
            SERVER_TOKEN: "${API_TOKEN}",
          },
        },
      },
    });

    await expect(loadExternalServerRegistry(tempDir)).rejects.toThrow(ExternalServerError);
  });
});

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadExternalServerRegistry } from "../src/external/registry";

async function writeFile(p: string, content: string) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, "utf8");
}

async function writeServersJson(tempDir: string, payload: unknown) {
  await writeFile(
    path.join(tempDir, "servers.json"),
    JSON.stringify(payload, null, 2),
  );
}

describe("dotenv loading for servers.json expansion", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "oplink-dotenv-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    delete process.env.DOTENV_TOKEN;
    delete process.env.SHELL_WINS;
  });

  it("expands placeholders from .env in the config dir", async () => {
    await writeFile(path.join(tempDir, ".env"), "DOTENV_TOKEN=from_file\n");
    await writeServersJson(tempDir, {
      servers: {
        example: {
          type: "stdio",
          command: "echo",
          args: ["ok"],
          env: { TOKEN: "${DOTENV_TOKEN}" },
        },
      },
    });

    const registry = await loadExternalServerRegistry(tempDir);
    const def = registry.servers.get("example");
    expect(def?.env).toEqual({ TOKEN: "from_file" });
  });

  it("prefers shell env over .env values", async () => {
    process.env.SHELL_WINS = "from_shell";
    await writeFile(path.join(tempDir, ".env"), "SHELL_WINS=from_file\n");
    await writeServersJson(tempDir, {
      servers: {
        demo: {
          type: "stdio",
          command: "echo",
          env: { X: "${SHELL_WINS}" },
        },
      },
    });

    const registry = await loadExternalServerRegistry(tempDir);
    const def = registry.servers.get("demo");
    expect(def?.env).toEqual({ X: "from_shell" });
  });

  it("does not fail if no .env files are present", async () => {
    await writeServersJson(tempDir, {
      servers: {
        deepwiki: {
          type: "http",
          url: "https://mcp.deepwiki.com/sse",
        },
      },
    });

    const registry = await loadExternalServerRegistry(tempDir);
    expect(registry.servers.has("deepwiki")).toBe(true);
  });
});


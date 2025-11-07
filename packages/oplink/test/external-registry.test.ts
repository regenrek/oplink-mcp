import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	ExternalServerError,
	loadExternalServerRegistry,
} from "../src/external/registry";

async function writeRegistry(tempDir: string, payload: unknown) {
	await fs.writeFile(
		path.join(tempDir, "servers.json"),
		JSON.stringify(payload, null, 2),
		"utf8",
	);
}

describe("loadExternalServerRegistry", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "oplink-registry-"));
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
		delete process.env.CONTEXT7_TOKEN;
		delete process.env.GRAFANA_TOKEN;
	});

	it("loads stdio and http servers with env expansion", async () => {
		process.env.CONTEXT7_TOKEN = "secret";
		process.env.GRAFANA_TOKEN = "graf";
		await writeRegistry(tempDir, {
			servers: {
				context7: {
					type: "stdio",
					command: "npx",
					args: ["-y", "@upstash/context7-mcp"],
					env: { CONTEXT7_TOKEN: "${CONTEXT7_TOKEN}" },
				},
				grafana: {
					type: "http",
					url: "https://grafana.example.com/mcp",
					headers: { Authorization: "Bearer ${GRAFANA_TOKEN}" },
				},
			},
		});

		const registry = await loadExternalServerRegistry(tempDir);
		const context7 = registry.servers.get("context7");
		expect(context7).toBeDefined();
		expect(context7?.command).toMatchObject({
			kind: "stdio",
			command: "npx",
			args: ["-y", "@upstash/context7-mcp"],
			cwd: tempDir,
		});
		expect(context7?.env).toEqual({ CONTEXT7_TOKEN: "secret" });

		const grafana = registry.servers.get("grafana");
		expect(grafana?.command).toMatchObject({
			kind: "http",
			url: new URL("https://grafana.example.com/mcp"),
			headers: { Authorization: "Bearer graf" },
		});
	});

	it("throws when required environment variables are missing", async () => {
		await writeRegistry(tempDir, {
			servers: {
				context7: {
					type: "stdio",
					command: "npx",
					env: { TOKEN: "${MISSING_TOKEN}" },
				},
			},
		});

		await expect(loadExternalServerRegistry(tempDir)).rejects.toThrow(
			ExternalServerError,
		);
	});

	it("throws when servers.json is missing", async () => {
		await expect(loadExternalServerRegistry(tempDir)).rejects.toThrow(
			/Missing MCP server registry/,
		);
	});

	it("rejects aliases containing a colon", async () => {
		await writeRegistry(tempDir, {
			servers: {
				"context7:docs": {
					type: "stdio",
					command: "npx",
				},
			},
		});

		await expect(loadExternalServerRegistry(tempDir)).rejects.toThrow(
			/alias 'context7:docs'/,
		);
	});

	it("rejects duplicate aliases after normalization", async () => {
		await writeRegistry(tempDir, {
			servers: {
				context7: {
					type: "stdio",
					command: "npx",
				},
				"context7 ": {
					type: "stdio",
					command: "node",
				},
			},
		});

		await expect(loadExternalServerRegistry(tempDir)).rejects.toThrow(
			/Duplicate server alias/i,
		);
	});

	it("supports HTTP-based servers like DeepWiki", async () => {
		await writeRegistry(tempDir, {
			servers: {
				deepwiki: {
					type: "http",
					url: "https://mcp.deepwiki.com/sse",
					description: "DeepWiki knowledge base",
				},
			},
		});

		const registry = await loadExternalServerRegistry(tempDir);
		const definition = registry.servers.get("deepwiki");
		expect(definition).toBeDefined();
		expect(definition?.command).toMatchObject({
			kind: "http",
			url: new URL("https://mcp.deepwiki.com/sse"),
		});
		expect(definition?.description).toBe("DeepWiki knowledge base");
	});
});

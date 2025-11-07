import { describe, expect, it, beforeEach, vi } from "vitest";
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

describe("registerToolsFromConfig - external proxies", () => {
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

				if (typeof rest[0] === "string") {
					description = rest.shift();
				}
				if (rest.length === 2) {
					schema = rest.shift();
				}
				handler = rest[0];

				registrations.push({ name, description, schema, handler });
			},
		};

	});

	it("converts JSON schema to Zod and proxies execution", async () => {
		listToolsMock.mockResolvedValue([
			{
				name: "get-docs",
				description: "Get docs",
				inputSchema: {
					type: ["null", "object"],
					properties: {
						filter: {
							type: "string",
							description: "Filter query",
						},
						limit: {
							type: "integer",
							default: 5,
						},
					},
					required: ["filter"],
				},
			},
		]);
		const config = {
			workflow: {
				description: "Doc workflow",
				prompt: "Use docs",
				externalServers: ["context7"],
			},
		};

		await registerToolsFromConfig(server as any, config, { configDir: "/tmp/config" });

		const proxy = registrations.find((item) => item.name === "context7:get-docs");
		expect(proxy).toBeDefined();
		const shape = proxy?.schema;
		expect(shape).toBeDefined();
		const schema = z.object(shape!);
		const parsed = schema.parse({ filter: "grafana" });
		expect(parsed.filter).toBe("grafana");
		expect(parsed.limit).toBe(5);

		executeExternalToolMock.mockResolvedValue({ content: [] });
		await proxy?.handler({ filter: "grafana" });
		expect(executeExternalToolMock).toHaveBeenCalledWith(
			"context7",
			"get-docs",
			{ filter: "grafana" },
			"/tmp/config",
		);
	});

	it("fails when explicit proxy tool is missing upstream", async () => {
		listToolsMock.mockResolvedValue([]);
		const config = {
			"context7:get-docs": {
				description: "Direct proxy",
			},
		};

		await expect(
			registerToolsFromConfig(server as any, config, { configDir: "/tmp/config" }),
		).rejects.toThrow(/does not expose tool/);
	});
	it("registers HTTP aliases like deepwiki via externalServers", async () => {
		listToolsMock.mockResolvedValue([
			{
				name: "deepwiki_search",
				description: "Search DeepWiki",
				inputSchema: {
					type: "object",
					properties: {
						query: { type: "string" },
					},
					required: ["query"],
				},
			},
		]);

		const config = {
			lookup: {
				description: "Lookup",
				prompt: "Run deepwiki search",
				externalServers: ["deepwiki"],
			},
		};

		await registerToolsFromConfig(server as any, config, { configDir: "/tmp/config" });
		expect(listToolsMock).toHaveBeenCalledWith("deepwiki", "/tmp/config", true);
		const proxy = registrations.find((item) => item.name === "deepwiki:deepwiki_search");
		expect(proxy).toBeDefined();
	});
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listToolsMock = vi.fn();
const callToolMock = vi.fn();
const createRuntimeMock = vi.fn(async () => ({
	listTools: listToolsMock,
	callTool: callToolMock,
}));

const loadRegistryMock = vi.fn();

vi.mock("../src/external/registry", () => {
	class MockExternalServerError extends Error {}
	return {
		ExternalServerError: MockExternalServerError,
		loadExternalServerRegistry: loadRegistryMock,
	};
});

vi.mock("mcporter", () => ({
	createRuntime: createRuntimeMock,
}));

const {
	listExternalServerTools,
	executeExternalTool,
	resetExternalRuntimeCache,
} = await import("../src/external-tools");
const { ExternalServerError } = await import("../src/external/registry");

describe("external-tools runtime", () => {
	beforeEach(() => {
		resetExternalRuntimeCache();
		listToolsMock.mockReset();
		callToolMock.mockReset();
		createRuntimeMock.mockReset();
		createRuntimeMock.mockResolvedValue({
			listTools: listToolsMock,
			callTool: callToolMock,
		});
		loadRegistryMock.mockReset();
		loadRegistryMock.mockResolvedValue({
			configDir: "/tmp/config",
			registryPath: "/tmp/config/servers.json",
			servers: new Map([
				[
					"context7",
					{
						name: "context7",
						description: "ctx7",
						command: { kind: "http", url: new URL("https://ctx7.example.com/mcp") },
					},
				],
			]),
		});
	});

	afterEach(() => {
		resetExternalRuntimeCache();
	});

	it("lists tools through cached runtime", async () => {
		listToolsMock.mockResolvedValue([
			{ name: "get_docs", description: "Get docs" },
		]);

		const tools = await listExternalServerTools("context7", "/tmp/config", true);
		expect(tools).toHaveLength(1);
		expect(listToolsMock).toHaveBeenCalledWith("context7", { includeSchema: true });
		expect(createRuntimeMock).toHaveBeenCalledTimes(1);

		await listExternalServerTools("context7", "/tmp/config", false);
		expect(createRuntimeMock).toHaveBeenCalledTimes(1);
	});

	it("executes remote tool with provided arguments", async () => {
		callToolMock.mockResolvedValue({ content: [] });

		const result = await executeExternalTool(
			"context7",
			"get_docs",
			{ topic: "grafana" },
			"/tmp/config",
		);

		expect(result).toEqual({ content: [] });
		expect(callToolMock).toHaveBeenCalledWith("context7", "get_docs", {
			args: { topic: "grafana" },
		});
	});

	it("throws when alias is missing", async () => {
		loadRegistryMock.mockResolvedValue({
			configDir: "/tmp/config",
			registryPath: "/tmp/config/servers.json",
			servers: new Map(),
		});

		await expect(
			listExternalServerTools("missing", "/tmp/config", true),
		).rejects.toThrow(ExternalServerError);
	});

	it("resets runtime cache", async () => {
		listToolsMock.mockResolvedValue([]);
		await listExternalServerTools("context7", "/tmp/config", true);
		expect(createRuntimeMock).toHaveBeenCalledTimes(1);
		resetExternalRuntimeCache();
		await listExternalServerTools("context7", "/tmp/config", true);
		expect(createRuntimeMock).toHaveBeenCalledTimes(2);
	});
});

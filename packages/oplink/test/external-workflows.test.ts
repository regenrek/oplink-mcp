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

describe("external server workflows", () => {
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

	it("registers a proxy workflow for a single server", async () => {
		listToolsMock.mockResolvedValue([
			{
				name: "take_screenshot",
				description: "Capture a screenshot",
				inputSchema: {
					type: "object",
					properties: {
						format: {
							type: "string",
							enum: ["png", "jpeg", "webp"],
							default: "png",
						},
					},
					required: [],
				},
			},
		]);

		const config = {
			frontend_debugger: {
				description: "Chrome DevTools quick access",
				prompt: "Provide {\"tool\": \"name\", \"args\": {...}}",
				externalServers: ["chrome-devtools"],
			},
		};

	await registerToolsFromConfig(server as any, config, {
		configDir: "/tmp/config",
	});

	const describeTool = registrations.find((r) => r.name === "describe_tools");
	expect(describeTool).toBeDefined();
	const workflow = registrations.find((r) => r.name === "frontend_debugger");
	expect(workflow).toBeDefined();
    const workflowTool = workflow!;
    expect(workflowTool.schema).toBeDefined();
    // schema is JSON Schema when registered by the server; verify core shape
    const json = workflowTool.schema as any;
    expect(json.type).toBe("object");
    expect(json.properties).toBeTypeOf("object");

	const promptResponse = await workflowTool.handler();
	expect(promptResponse.content[0].text).toContain("Provide");
	expect(promptResponse.content[0].text).toContain("describe_tools");

	executeExternalToolMock.mockResolvedValue({ content: [] });
	await workflowTool.handler({ tool: "take_screenshot", args: { format: "png" } });
		expect(executeExternalToolMock).toHaveBeenCalledWith(
			"chrome-devtools",
			"take_screenshot",
			{ format: "png" },
			"/tmp/config",
		);
	});

	it("allows specifying server or alias prefix when multiple servers are available", async () => {
		listToolsMock.mockImplementation(async (alias: string) => {
			if (alias === "chrome-devtools") {
				return [
					{
						name: "navigate_page",
						description: "Navigate",
						inputSchema: {
							type: "object",
							properties: {
								url: { type: "string" },
							},
							required: ["url"],
						},
					},
				];
			}
			return [
				{
					name: "list",
					description: "List components",
					inputSchema: {
						type: "object",
						properties: {
							query: { type: "string" },
						},
					},
				},
			];
		});

		const config = {
			helpers: {
				description: "Mixed helper",
				prompt: "Use chrome-devtools or shadcn tools",
				externalServers: ["chrome-devtools", "shadcn"],
			},
		};

	await registerToolsFromConfig(server as any, config, {
		configDir: "/tmp/config",
	});

	const describeTool = registrations.find((r) => r.name === "describe_tools");
	expect(describeTool).toBeDefined();
	const workflow = registrations.find((r) => r.name === "helpers");
	expect(workflow).toBeDefined();
	const handler = workflow!.handler;
		executeExternalToolMock.mockResolvedValue({ content: [] });

		await handler({ tool: "chrome-devtools:navigate_page", args: { url: "https://example.com" } });
		expect(executeExternalToolMock).toHaveBeenCalledWith(
			"chrome-devtools",
			"navigate_page",
			{ url: "https://example.com" },
			"/tmp/config",
		);

		await handler({ server: "shadcn", tool: "list" });
		expect(executeExternalToolMock).toHaveBeenCalledWith(
			"shadcn",
			"list",
			{},
			"/tmp/config",
		);
	});

	it("provides describe_tools output with cached schemas", async () => {
		listToolsMock.mockResolvedValue([
			{
				name: "take_screenshot",
				description: "Capture a screenshot",
				inputSchema: {
					type: "object",
					properties: {
						format: { type: "string" },
					},
				},
			},
			{
				name: "list_tabs",
				description: "List open tabs",
				inputSchema: {
					type: "object",
					properties: {
						pattern: { type: "string" },
					},
				},
			},
		]);

		const config = {
			frontend_debugger: {
				description: "Chrome DevTools quick access",
				externalServers: ["chrome-devtools"],
			},
		};

		await registerToolsFromConfig(server as any, config, {
			configDir: "/tmp/config",
		});

		const describeTool = registrations.find((r) => r.name === "describe_tools");
		expect(describeTool).toBeDefined();
		const response = await describeTool!.handler({ workflow: "frontend_debugger" });
		const payload = JSON.parse(response.content[0].text);
		expect(payload.workflows[0].workflow).toBe("frontend_debugger");
		const tools = payload.workflows[0].aliases[0].tools.map((t: any) => t.name);
		expect(tools).toEqual(expect.arrayContaining(["take_screenshot", "list_tabs"]));
	});

	it("registers external_auth_setup helper", async () => {
		listToolsMock.mockResolvedValue([
			{
				name: "take_screenshot",
				description: "Capture",
				inputSchema: { type: "object", properties: {} },
			},
		]);

		const config = {
			frontend_debugger: {
				description: "Chrome DevTools quick access",
				externalServers: ["chrome-devtools"],
			},
		};

		await registerToolsFromConfig(server as any, config, { configDir: "/tmp/config" });

		const helper = registrations.find((r) => r.name === "external_auth_setup");
		expect(helper).toBeDefined();

		listToolsMock.mockClear();
		listToolsMock.mockResolvedValue([
			{ name: "take_screenshot" },
		]);

		const response = await helper!.handler();
		expect(listToolsMock).toHaveBeenCalled();
		expect(response.content[0].text).toContain("Initialized");
	});

	it("suggests describe_tools when OAuth auth fails", async () => {
		listToolsMock.mockResolvedValue([
			{
				name: "take_screenshot",
				description: "Capture",
				inputSchema: { type: "object", properties: {} },
			},
		]);

		const config = {
			frontend_debugger: {
				description: "Chrome DevTools quick access",
				externalServers: ["chrome-devtools"],
			},
		};

		await registerToolsFromConfig(server as any, config, { configDir: "/tmp/config" });

		const workflow = registrations.find((r) => r.name === "frontend_debugger");
		expect(workflow).toBeDefined();

		executeExternalToolMock.mockRejectedValueOnce(new Error("OAuth authorization required"));
		const response = await workflow!.handler({ tool: "take_screenshot" });
		expect(response.content[0].text).toContain('describe_tools({ "workflow": "frontend_debugger"');
		expect(response.isError).toBeUndefined();
	});
});

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

describe("scripted workflows", () => {
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

	it("registers scripted workflows and keeps helper tools hidden", async () => {
		listToolsMock.mockResolvedValueOnce([
			{
				name: "navigate_page",
				description: "Navigate",
				inputSchema: {
					type: "object",
					properties: {
						type: { type: "string" },
						url: { type: "string" },
					},
					required: ["type", "url"],
				},
			},
			{
				name: "take_screenshot",
				description: "Screenshot",
				inputSchema: {
					type: ["object", "null"],
					properties: {
						fullPage: { type: "boolean" },
					},
				},
			},
		]);

		executeExternalToolMock
			.mockResolvedValueOnce({ content: [{ type: "text", text: "Navigated" }] })
			.mockResolvedValueOnce({
				content: [{ type: "image", data: "base64", mimeType: "image/png" }],
			});

		const config = {
			take_screenshot: {
				description: "Capture screenshot",
				runtime: "scripted",
				parameters: {
					url: {
						type: "string",
						required: true,
					},
				},
				steps: [
					{ call: "chrome-devtools:navigate_page", args: { type: "url", url: "{{ url }}" } },
					{ call: "chrome-devtools:take_screenshot", args: { fullPage: true } },
				],
			},
		};

	await registerToolsFromConfig(server as any, config, {
		configDir: "/tmp/config",
	});


	const workflowTool = registrations.find((r) => r.name === "take_screenshot");
	const describeTool = registrations.find((r) => r.name === "describe_tools");
	expect(workflowTool).toBeDefined();
	expect(describeTool).toBeDefined();

	expect(workflowTool!.schema).toBeDefined();
	expect(z.object(workflowTool!.schema!).parse({ url: "https://example.com" })).toEqual({
		url: "https://example.com",
	});

	const result = await workflowTool!.handler({ url: "https://example.com" });
		expect(executeExternalToolMock).toHaveBeenNthCalledWith(
			1,
			"chrome-devtools",
			"navigate_page",
			{ type: "url", url: "https://example.com" },
			"/tmp/config",
		);
		expect(executeExternalToolMock).toHaveBeenNthCalledWith(
			2,
			"chrome-devtools",
			"take_screenshot",
			{ fullPage: true },
			"/tmp/config",
		);

	expect(result.content).toHaveLength(4);
	expect(result.content[0]).toEqual({
			type: "text",
			text: "Step 1: chrome-devtools:navigate_page",
		});
	});

	it("throws when scripted workflow references unknown tool", async () => {
		listToolsMock.mockResolvedValueOnce([]);
		const config = {
			bad_workflow: {
				runtime: "scripted",
				steps: [{ call: "chrome-devtools:missing" }],
			},
		};

	await expect(
		registerToolsFromConfig(server as any, config, {
			configDir: "/tmp/config",
		}),
	).rejects.toThrow(/references unknown tool 'chrome-devtools:missing'/);
	});

	it("wraps step errors with alias/tool and step index", async () => {
		listToolsMock.mockResolvedValueOnce([
			{ name: "jira_search", description: "Search", inputSchema: { type: "object" } },
		]);
		executeExternalToolMock.mockRejectedValueOnce(new Error("Error calling tool 'search'"));

		const config = {
			wf: {
				runtime: "scripted",
				steps: [
					{ call: "atlassian:jira_search", args: { jql: "assignee = me()" } },
				],
			},
		};

    await registerToolsFromConfig(server as any, config, { configDir: "/tmp/config" });
    const workflowTool = registrations.find((r) => r.name === "wf");
    const res = await workflowTool!.handler({});
    const text = (res.content?.[0] as any)?.text ?? "";
    expect(text).toMatch(/Step #1 \(atlassian:jira_search\) failed: Error calling tool 'search'/);
	});

	it("requires a configDir for scripted workflows", async () => {
		const config = {
			bad_workflow: {
				runtime: "scripted",
				steps: [{ call: "chrome-devtools:navigate_page" }],
			},
		};

	await expect(
		registerToolsFromConfig(server as any, config, {}),
	).rejects.toThrow(
		/External MCP workflows require --config <dir> so Oplink can load servers\.json/,
	);
	});
});

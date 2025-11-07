import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ServerToolInfo } from "mcporter";
import { z } from "zod";
import {
	convertParametersToZodSchema,
	loadConfigSync,
	mergeConfigs,
	validateToolConfig,
} from "./config";
import { loadAvailablePresets, loadPresetConfigs } from "./preset";
import { promptFunctions } from "./prompts";
import {
	appendFormattedTools,
	formatToolsList,
	processTemplate,
} from "./utils";
import {
	ExternalServerError,
	executeExternalTool,
	listExternalServerTools,
} from "./external-tools";

interface RegisterOptions {
	configDir?: string;
}

/**
 * Creates and configures the MCP server with tools from the provided configuration
 * @param config - The tool configuration object
 * @param version - Server version
 */
export async function createMcpServer(
	config: Record<string, any>,
	version: string,
	options: RegisterOptions = {},
): Promise<McpServer> {
	// Create an MCP server
	const server = new McpServer(
		{
			name: "DevTools MCP",
			version: version,
		},
		{
			capabilities: {
				tools: {},
			},
		},
	);

	// Register all tools from the config
	await registerToolsFromConfig(server, config, options);

	return server;
}

/**
 * Registers tools to the MCP server based on the provided configuration
 * @param server - The MCP server instance
 * @param config - The tool configuration object
 */
export async function registerToolsFromConfig(
	server: McpServer,
	config: Record<string, any>,
	options: RegisterOptions = {},
): Promise<void> {
	const registeredNames = new Set<string>();
	const aliasMeta = new Map<string, { registerAll: boolean; explicitTools: Set<string> }>();
	const explicitProxyDescriptions = new Map<string, string | undefined>();

	for (const [key, toolConfig] of Object.entries(config)) {
		if (!toolConfig || toolConfig.disabled) {
			continue;
		}

		const validationError = validateToolConfig(config, key);
		if (validationError) {
			throw new Error(validationError);
		}

		if (key.includes(':')) {
			const { server: alias, tool } = parseExternalToolKey(key);
			const meta = aliasMeta.get(alias) ?? {
				registerAll: false,
				explicitTools: new Set<string>(),
			};
			meta.explicitTools.add(tool);
			aliasMeta.set(alias, meta);
			explicitProxyDescriptions.set(key, toolConfig.description);
			continue;
		}

		if (Array.isArray(toolConfig.externalServers)) {
			for (const alias of toolConfig.externalServers) {
				const normalized = alias.trim();
				const meta = aliasMeta.get(normalized) ?? {
					registerAll: false,
					explicitTools: new Set<string>(),
				};
				meta.registerAll = true;
				aliasMeta.set(normalized, meta);
			}
		}

		registerLocalTool(server, key, toolConfig, config, registeredNames);
	}

	if (aliasMeta.size === 0) {
		return;
	}

	if (!options.configDir) {
		throw new ExternalServerError(
			"External MCP servers require --config <dir> so Oplink can load servers.json",
		);
	}

	const discoveryResults = await discoverExternalToolMaps(
		aliasMeta,
		options.configDir,
	);

	for (const [alias, tools] of discoveryResults) {
		const meta = aliasMeta.get(alias);
		if (!meta) {
			continue;
		}

		if (meta.registerAll) {
			for (const [toolName, info] of tools) {
				const proxyName = `${alias}:${toolName}`;
				const override = explicitProxyDescriptions.get(proxyName);
				registerExternalProxyTool(
					server,
					proxyName,
					alias,
					info,
					override,
					options.configDir,
					registeredNames,
				);
			}
			for (const toolName of meta.explicitTools) {
				if (!tools.has(toolName)) {
					throw new ExternalServerError(
						`Server '${alias}' does not expose tool '${toolName}'. Check servers.json or run 'mcporter list ${alias}'.`,
					);
				}
			}
			continue;
		}

		for (const toolName of meta.explicitTools) {
			const info = tools.get(toolName);
			if (!info) {
				throw new ExternalServerError(
					`Server '${alias}' does not expose tool '${toolName}'. Check servers.json or run 'mcporter list ${alias}'.`,
				);
			}
			const proxyName = `${alias}:${toolName}`;
			const override = explicitProxyDescriptions.get(proxyName);
			registerExternalProxyTool(
				server,
				proxyName,
				alias,
				info,
				override,
				options.configDir,
				registeredNames,
			);
		}
	}
}

/**
 * Processes the template with parameters
 */
function generateToolPrompt(
	key: string,
	toolConfig: Record<string, any>,
	promptFunction:
		| ((config: Record<string, any>, params?: Record<string, any>) => string)
		| undefined,
	fullConfig: Record<string, any>,
	params?: Record<string, any>,
): string {
	let basePrompt = "";

	if (promptFunction) {
		return promptFunction(fullConfig, params);
	}

	if (toolConfig.prompt) {
		basePrompt = toolConfig.prompt;
		if (toolConfig.context) {
			basePrompt += `\n\n${toolConfig.context}`;
		}
		if (toolConfig.tools) {
			const toolsList = formatToolsList(toolConfig.tools);
			basePrompt = appendFormattedTools(
				basePrompt,
				toolsList,
				toolConfig.toolMode,
			);
		}
	} else {
		console.error(`Tool "${key}" has no prompt defined`);
		basePrompt = `# ${key}\n\nNo prompt defined for this tool.`;
	}

	const processed = processTemplate(basePrompt, params || {});
	return processed.result;
}

function registerLocalTool(
	server: McpServer,
	configKey: string,
	toolConfig: Record<string, any>,
	fullConfig: Record<string, any>,
	registeredNames: Set<string>,
): void {
	const promptFunction = promptFunctions[configKey];
	const toolName = toolConfig.name || configKey;
	if (registeredNames.has(toolName)) {
		throw new Error(`Tool name '${toolName}' is already registered.`);
	}

	let inputSchema:
		| Record<string, z.ZodTypeAny>
		| undefined;
	if (toolConfig.parameters && Object.keys(toolConfig.parameters).length > 0) {
		inputSchema = convertParametersToZodSchema(toolConfig.parameters);
	}

	const description =
		toolConfig.description || `${configKey.replace(/_/g, " ")} tool`;

	const registerCallback = async (
		params?: Record<string, any>,
	): Promise<any> => {
		try {
			const text = generateToolPrompt(
				configKey,
				toolConfig,
				promptFunction,
				fullConfig,
				params,
			);
			return { content: [{ type: "text", text }] };
		} catch (error) {
			return buildToolError(error);
		}
	};

	if (inputSchema) {
		server.tool(toolName, description, inputSchema, registerCallback);
	} else {
		server.tool(toolName, description, registerCallback);
	}

	registeredNames.add(toolName);
}

async function discoverExternalToolMaps(
	aliasMeta: Map<string, { registerAll: boolean; explicitTools: Set<string> }>,
	configDir: string,
): Promise<Map<string, Map<string, ServerToolInfo>>> {
	const entries = await Promise.all(
		[...aliasMeta.keys()].map(async (alias) => {
			const tools = await listExternalServerTools(alias, configDir, true);
			const map = new Map<string, ServerToolInfo>();
			for (const tool of tools) {
				map.set(tool.name, tool);
			}
			return [alias, map] as const;
		}),
	);
	return new Map(entries);
}

function registerExternalProxyTool(
	server: McpServer,
	proxyName: string,
	alias: string,
	toolInfo: ServerToolInfo,
	descriptionOverride: string | undefined,
	configDir: string,
	registeredNames: Set<string>,
): void {
	if (registeredNames.has(proxyName)) {
		throw new Error(`Tool name '${proxyName}' is already registered.`);
	}

	const description =
		descriptionOverride ||
		toolInfo.description ||
		`${alias}:${toolInfo.name}`;

	const shape = convertJsonSchemaToZodShape(toolInfo.inputSchema);

	const handler = async (params?: Record<string, any>) => {
		try {
			return (await executeExternalTool(
				alias,
				toolInfo.name,
				params,
				configDir,
			)) as any;
		} catch (error) {
			return buildToolError(error);
		}
	};

	if (shape) {
		server.tool(proxyName, description, shape, handler);
	} else {
		server.tool(proxyName, description, handler);
	}

	registeredNames.add(proxyName);
}

function parseExternalToolKey(key: string): { server: string; tool: string } {
	const tokens = key.split(":");
	if (tokens.length !== 2) {
		throw new Error(
			`External tool key '${key}' must contain exactly one ':' separating server and tool`,
		);
	}
	const [serverName, toolName] = tokens.map((token) => token.trim());
	if (!serverName || !toolName) {
		throw new Error(
			`External tool key '${key}' must include both server and tool segments`,
		);
	}
	return { server: serverName, tool: toolName };
}

function convertJsonSchemaToZodShape(
	schema: unknown,
): Record<string, z.ZodTypeAny> | undefined {
	if (!schema || typeof schema !== "object") {
		return undefined;
	}
	const typed = schema as {
		type?: string | string[];
		properties?: Record<string, unknown>;
		required?: string[];
	};
	const typeList = normalizeTypeList(typed.type);
	const treatsAsEmptyObject =
		typeList.length === 0 ||
		(typeList.length === 1 && typeList[0] === "null");
	if (treatsAsEmptyObject && !typed.properties) {
		return undefined;
	}
	if (typeList.length > 0 && !typeList.includes("object") && !typed.properties) {
		throw new Error(
			`Unsupported input schema type '${typeList.join(",")}' for external tool; expected object schema`,
		);
	}
	const properties = typed.properties ?? {};
	const required = new Set(typed.required ?? []);
	const shape: Record<string, z.ZodTypeAny> = {};
	for (const [name, propertySchema] of Object.entries(properties)) {
		const field = jsonSchemaToZodType(propertySchema);
		const hasDefault = Object.prototype.hasOwnProperty.call(
			propertySchema,
			"default",
		);
		if (required.has(name)) {
			shape[name] = field;
			continue;
		}
		shape[name] = hasDefault ? field : field.optional();
	}
	return shape;
}

function jsonSchemaToZodType(schema: unknown): z.ZodTypeAny {
	if (!schema || typeof schema !== "object") {
		return z.unknown();
	}
	const typed = schema as Record<string, any>;
	if (Array.isArray(typed.enum) && typed.enum.length > 0) {
		return buildEnumSchema(typed.enum);
	}
	if (typed.const !== undefined) {
		return z.literal(typed.const);
	}
	const types = normalizeTypeList(typed.type);
	const treatAsObject =
		(types.length === 0 || types.includes("object")) && typed.properties;
	if (treatAsObject) {
		const shape = convertJsonSchemaToZodShape(schema);
		if (shape) {
			const objectSchema = z.object(shape);
			return withMetadata(objectSchema, typed);
		}
		return z.object({});
	}
	if (!types || types.length === 0) {
		return z.unknown();
	}
	if (types.includes("string")) {
		let str = z.string();
		if (typeof typed.minLength === "number") {
			str = str.min(typed.minLength);
		}
		if (typeof typed.maxLength === "number") {
			str = str.max(typed.maxLength);
		}
		if (typeof typed.pattern === "string") {
			try {
				str = str.regex(new RegExp(typed.pattern));
			} catch {
				// Ignore invalid regex
			}
		}
		return withMetadata(str, typed);
	}
	if (types.includes("integer") || types.includes("number")) {
		let num = z.number();
		if (types.includes("integer")) {
			num = num.int();
		}
		if (typeof typed.minimum === "number") {
			num = num.min(typed.minimum);
		}
		if (typeof typed.maximum === "number") {
			num = num.max(typed.maximum);
		}
		return withMetadata(num, typed);
	}
	if (types.includes("boolean")) {
		return withMetadata(z.boolean(), typed);
	}
	if (types.includes("array")) {
		const items = Array.isArray(typed.items)
			? typed.items[0]
			: typed.items;
		let arraySchema = z.array(jsonSchemaToZodType(items));
		if (typeof typed.minItems === "number") {
			arraySchema = arraySchema.min(typed.minItems);
		}
		if (typeof typed.maxItems === "number") {
			arraySchema = arraySchema.max(typed.maxItems);
		}
		return withMetadata(arraySchema, typed);
	}
	if (types.includes("object")) {
		const shape = convertJsonSchemaToZodShape(schema);
		if (shape) {
			const objectSchema = z.object(shape);
			return withMetadata(objectSchema, typed);
		}
	}
	return z.unknown();
}

function buildEnumSchema(values: unknown[]): z.ZodTypeAny {
	const unique = [...new Set(values)];
	if (unique.length === 1) {
		return z.literal(unique[0] as any);
	}
	if (unique.every((value) => typeof value === "string")) {
		return z.enum(unique as [string, string, ...string[]]);
	}
	const literals = unique.map((value) => z.literal(value as any));
	return z.union(literals as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
}

function withMetadata<T extends z.ZodTypeAny>(
	schema: T,
	definition: Record<string, any>,
): T {
	let result = schema;
	if (definition.description) {
		result = result.describe(definition.description) as T;
	}
	if (definition.default !== undefined) {
		result = result.default(definition.default) as T;
	}
	return result;
}

function normalizeTypeList(type: string | string[] | undefined): string[] {
	if (!type) {
		return [];
	}
	return Array.isArray(type) ? type : [type];
}

function buildToolError(error: unknown) {
	const message =
		error instanceof Error ? error.message : String(error ?? "Unknown error");
	return {
		content: [
			{
				type: "text",
				text: `Error executing tool: ${message}`,
			},
		],
		isError: true,
	};
}

/**
 * Starts the MCP server with the specified transport
 * @param server - The configured MCP server
 * @param presets - Array of preset names used
 * @param configPath - Optional path to user config
 */
export async function startServer(
	server: McpServer,
	presets: string[],
	configPath?: string,
): Promise<void> {
	const transport = new StdioServerTransport();
	try {
		await server.connect(transport);
		console.error(
			`DevTools MCP server running with presets: ${presets.join(", ")}${
				configPath ? ` and user config from: ${configPath}` : ""
			}`,
		);
	} catch (err) {
		console.error("Error starting server:", err);
	}
}

export function loadAndMergeConfig(
	presets: string[],
	configPath?: string,
	presetsDir?: string,
): Record<string, any> {
	// Log available presets
	const availablePresets = loadAvailablePresets(presetsDir);
	console.error(`Available presets: ${availablePresets.join(", ")}`);
	console.error(`Using presets: ${presets.join(", ")}`);

	// 1. Load preset configs from the specified directory (or fallback)
	const presetConfig = loadPresetConfigs(presets, presetsDir);
	console.error(
		`Loaded ${Object.keys(presetConfig).length} tools from presets`,
	);

	// 2. Load user configs from .workflows directory if provided
	const userConfig = configPath ? loadConfigSync(configPath) : {};
	if (configPath) {
		console.error(
			`Loaded ${
				Object.keys(userConfig).length
			} tool configurations from user config directory: ${configPath}`,
		);
	}

	// 3. Merge configs (user config overrides preset config)
	const finalConfig = mergeConfigs(presetConfig, userConfig);
	console.error(
		`Final configuration contains ${Object.keys(finalConfig).length} tools`,
	);

	return finalConfig;
}

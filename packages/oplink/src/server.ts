import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ServerToolInfo } from "mcporter";
import { z } from "zod";
import type { StepConfig } from "./@types/config";
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
} from "./external-tools";
import {
	ExternalToolCache,
	type ExternalToolCacheOptions,
} from "./external/cache";

interface RegisterOptions {
	configDir?: string;
	cacheOptions?: ExternalToolCacheOptions;
}

type WorkflowRuntimeKind = "prompt" | "scripted" | "external";

interface WorkflowDescribeMetadata {
	name: string;
	runtime: WorkflowRuntimeKind;
	description: string;
	aliases: Set<string>;
	scriptedToolHints: Map<string, Set<string>>;
	autoAliases: Set<string>;
}

type AliasTracker = {
	registerAll: boolean;
	explicitTools: Set<string>;
};

function ensureWorkflowMetadata(
	store: Map<string, WorkflowDescribeMetadata>,
	name: string,
	runtime: WorkflowRuntimeKind,
	description: string,
): WorkflowDescribeMetadata {
	const existing = store.get(name);
	if (existing) {
		existing.runtime = runtime;
		existing.description = description;
	return existing;
	}
	const entry: WorkflowDescribeMetadata = {
		name,
		runtime,
		description,
		aliases: new Set<string>(),
		scriptedToolHints: new Map<string, Set<string>>(),
		autoAliases: new Set<string>(),
	};
	store.set(name, entry);
	return entry;
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

	// Ensure tool request handlers are ready even if no tools are registered yet
	const anyServer = server as unknown as {
		setToolRequestHandlers?: () => void;
	};
	anyServer.setToolRequestHandlers?.();

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
	const promptWorkflows: Array<{ name: string; config: Record<string, any> }> = [];
	const scriptedWorkflows: Array<{ name: string; config: Record<string, any> }> = [];
	const externalWorkflows: Array<{ name: string; config: Record<string, any> }> = [];
	const aliasMeta = new Map<string, AliasTracker>();
	const workflowCatalog = new Map<string, WorkflowDescribeMetadata>();

	for (const [key, toolConfig] of Object.entries(config)) {
		if (!toolConfig || toolConfig.disabled) {
			continue;
		}

		const validationError = validateToolConfig(config, key);
		if (validationError) {
			throw new Error(validationError);
		}

		const runtime = toolConfig.runtime ?? (toolConfig.steps ? "scripted" : "prompt");
		const hasExternalServers =
			Array.isArray(toolConfig.externalServers) &&
			toolConfig.externalServers.length > 0;
		const workflowType: WorkflowRuntimeKind = hasExternalServers
			? "external"
			: runtime === "scripted"
				? "scripted"
				: "prompt";
		const resolvedDescription = descriptionFromConfig(key, toolConfig);
		const workflowEntry = ensureWorkflowMetadata(
			workflowCatalog,
			key,
			workflowType,
			resolvedDescription,
		);

		if (runtime === "scripted") {
			scriptedWorkflows.push({ name: key, config: toolConfig });
			const aliasUsage = collectAliasRequirementsFromSteps(
				toolConfig.steps ?? [],
				aliasMeta,
			);
			for (const [alias, tools] of aliasUsage.entries()) {
				workflowEntry.aliases.add(alias);
				let hints = workflowEntry.scriptedToolHints.get(alias);
				if (!hints) {
					hints = new Set<string>();
					workflowEntry.scriptedToolHints.set(alias, hints);
				}
				for (const toolName of tools) {
					hints.add(toolName);
				}
			}
			continue;
		}

		if (hasExternalServers) {
			externalWorkflows.push({ name: key, config: toolConfig });
			for (const alias of toolConfig.externalServers as string[]) {
				const normalized = alias.trim();
				if (!normalized) {
					continue;
				}
				const meta = aliasMeta.get(normalized) ?? {
					registerAll: false,
					explicitTools: new Set<string>(),
				};
				meta.registerAll = true;
				aliasMeta.set(normalized, meta);
				workflowEntry.aliases.add(normalized);
				workflowEntry.autoAliases.add(normalized);
			}
			continue;
		}

		promptWorkflows.push({ name: key, config: toolConfig });
	}

	let discoveryCache: ExternalToolCache | undefined;
	if (aliasMeta.size > 0) {
		if (!options.configDir) {
			throw new ExternalServerError(
				"External MCP workflows require --config <dir> so Oplink can load servers.json",
			);
		}
		discoveryCache = new ExternalToolCache(
			options.configDir,
			options.cacheOptions,
		);
		await discoveryCache.restore();
		try {
			await discoveryCache.ensureAliases(aliasMeta.keys());
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(
				`Warning: failed to initialize external aliases at startup. You can run external_auth_setup or describe_tools later. Details: ${message}`,
			);
		}
	} else if (options.configDir) {
		discoveryCache = new ExternalToolCache(
			options.configDir,
			options.cacheOptions,
		);
		await discoveryCache.restore();
	}

	for (const entry of promptWorkflows) {
		await registerLocalTool(
			server,
			entry.name,
			entry.config,
			config,
			registeredNames,
			discoveryCache,
			options.configDir,
		);
	}

	for (const entry of scriptedWorkflows) {
		await registerLocalTool(
			server,
			entry.name,
			entry.config,
			config,
			registeredNames,
			discoveryCache,
			options.configDir,
		);
	}

	for (const entry of externalWorkflows) {
		await registerExternalServerWorkflow(
			server,
			entry.name,
			descriptionFromConfig(entry.name, entry.config),
			entry.config.prompt,
			entry.config.externalServers as string[],
			discoveryCache,
			options.configDir,
			registeredNames,
		);
	}

	registerDescribeToolsUtility(
		server,
		registeredNames,
		workflowCatalog,
		discoveryCache,
		options.configDir,
	);

	registerAuthBootstrapTool(
		server,
		registeredNames,
		discoveryCache,
		aliasMeta,
		options.configDir,
	);
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

async function registerLocalTool(
	server: McpServer,
	configKey: string,
	toolConfig: Record<string, any>,
	fullConfig: Record<string, any>,
	registeredNames: Set<string>,
	discoveryCache: ExternalToolCache | undefined,
	configDir?: string,
): Promise<void> {
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
	const inputParser = inputSchema ? z.object(inputSchema) : undefined;

	const runtime =
		toolConfig.runtime ?? (toolConfig.steps ? "scripted" : "prompt");
	if (runtime === "scripted") {
		await registerScriptedWorkflow(
			server,
			toolName,
			inputSchema,
			inputParser,
			descriptionFromConfig(configKey, toolConfig),
			toolConfig,
			discoveryCache,
			configDir,
			registeredNames,
		);
		return;
	}

	const description = descriptionFromConfig(configKey, toolConfig);

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

interface PreparedStep {
	alias: string;
	toolName: string;
	config: StepConfig;
	validator?: z.ZodTypeAny;
}

async function registerScriptedWorkflow(
	server: McpServer,
	toolName: string,
	inputShape: Record<string, z.ZodTypeAny> | undefined,
	inputParser: z.ZodObject<Record<string, z.ZodTypeAny>> | undefined,
	description: string,
	toolConfig: Record<string, any>,
	discoveryCache: ExternalToolCache | undefined,
	configDir: string | undefined,
	registeredNames: Set<string>,
): Promise<void> {
	if (!configDir) {
		throw new ExternalServerError(
			`Tool '${toolName}' requires --config for external MCP servers`,
		);
	}
	if (!discoveryCache) {
		throw new ExternalServerError(
			`Tool '${toolName}' references external MCP servers but none were loaded`,
		);
	}
	const steps = await prepareScriptedSteps(
		toolName,
		toolConfig.steps ?? [],
		discoveryCache,
	);

	const handler = async (params?: Record<string, any>) => {
		try {
			const normalizedParams = inputParser
				? inputParser.parse(params ?? {})
				: params ?? {};
			return await runScriptedWorkflow(
				toolName,
				steps,
				normalizedParams,
				configDir,
			);
		} catch (error) {
			return buildToolError(error);
		}
	};

	if (inputShape) {
		server.tool(toolName, description, inputShape, handler);
	} else {
		server.tool(toolName, description, handler);
	}

	registeredNames.add(toolName);
}

function registerExternalServerWorkflow(
	server: McpServer,
	toolName: string,
	description: string,
	promptText: string | undefined,
	aliases: string[],
	discoveryCache: ExternalToolCache | undefined,
	configDir: string | undefined,
	registeredNames: Set<string>,
): void {
	if (!configDir) {
		throw new ExternalServerError(
			`Tool '${toolName}' requires --config for external MCP servers`,
		);
	}
	if (!discoveryCache) {
		throw new ExternalServerError(
			`Tool '${toolName}' references external MCP servers but none were loaded`,
		);
	}
	const normalizedAliases = [...new Set(aliases.map((alias) => alias.trim()).filter(Boolean))];
	if (normalizedAliases.length === 0) {
		throw new Error(`Tool '${toolName}' must specify at least one server alias`);
	}
	const describeCall = buildDescribeCallSnippet(toolName, normalizedAliases);
	const describeHint = buildDescribeHint(toolName, normalizedAliases, describeCall);
	const promptWithHint = ensureDescribeHint(promptText, describeHint);
	const schemaShape: Record<string, z.ZodTypeAny> = {
		tool: z
			.string()
			.describe(
				`External tool to invoke (run ${describeCall} first, then set this field to the tool name)`,
			)
			.optional(),
		args: z
			.record(z.unknown())
			.describe("Arguments object forwarded to the external tool")
			.optional(),
	};
	if (normalizedAliases.length > 1) {
		schemaShape.server = z
			.enum(normalizedAliases as [string, string, ...string[]])
			.describe("Server alias to use (omit if specifying alias in tool)")
			.optional();
	}

    const handler = async (params?: Record<string, any>) => {
        let aliasUsed: string | undefined;
        let toolUsed: string | undefined;
        try {
            const normalized = params ?? {};
            let requestedTool = normalized.tool;
			if (!requestedTool || typeof requestedTool !== "string") {
				return { content: [{ type: "text", text: promptWithHint }] };
			}
			let alias: string | undefined = normalized.server;
			if (requestedTool.includes(":")) {
				const [maybeAlias, toolPart] = requestedTool.split(":");
				if (toolPart) {
					alias = maybeAlias;
					requestedTool = toolPart;
				}
			}
            if (!alias) {
                alias = normalizedAliases.length === 1 ? normalizedAliases[0] : undefined;
            }
            if (!alias) {
                throw new Error(
                    `Parameter 'server' is required when multiple aliases are available (${normalizedAliases.join(", ")})`,
                );
            }
            const toolInfo = await discoveryCache.getTool(alias, requestedTool);
            aliasUsed = alias;
            toolUsed = toolInfo.name;
            const rawArgs = normalized.args ?? normalized.arguments ?? {};
            if (rawArgs && typeof rawArgs !== "object") {
                throw new Error("Parameter 'args' must be an object if provided");
            }
            let parsedArgs: Record<string, any> = rawArgs;
            const shape = convertJsonSchemaToZodShape(toolInfo.inputSchema);
            if (shape) {
                parsedArgs = z.object(shape).parse(rawArgs ?? {});
            }
            return await executeExternalTool(alias, toolInfo.name, parsedArgs, configDir);
        } catch (error) {
            const authMessage = detectAuthError(error);
            if (authMessage) {
                const aliasHint = typeof alias === 'string' ? alias : normalizedAliases[0];
                return buildAuthReminder(toolName, aliasHint, authMessage);
            }
            const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
            const ctx = aliasUsed && toolUsed ? `${aliasUsed}:${toolUsed}` : undefined;
            const wrapped = ctx ? new Error(`Failed calling ${ctx}: ${message}`) : new Error(message);
            return buildToolError(wrapped);
        }
    };

	server.tool(toolName, description, schemaShape, handler);
	registeredNames.add(toolName);
}

function buildDescribeCallSnippet(workflowName: string, aliases: string[]): string {
	const aliasFragment =
		aliases.length > 1
			? `, "aliases": [${aliases.map((alias) => `"${alias}"`).join(", ")}]`
			: "";
	return `describe_tools({ "workflow": "${workflowName}"${aliasFragment} })`;
}

function buildDescribeHint(
	workflowName: string,
	aliases: string[],
	callSnippet: string,
): string {
	const aliasPrefix = aliases.length > 1 ? `${aliases[0]}:` : "";
	return `Start by running ${callSnippet} to inspect available commands, then call ${workflowName}({ "tool": "${aliasPrefix}tool_name", "args": { ... } }) with the details returned by describe_tools.`;
}

function ensureDescribeHint(promptText: string | undefined, hint: string): string {
	if (!promptText) {
		return hint;
	}
	if (promptText.toLowerCase().includes("describe_tools")) {
		return promptText;
	}
	return `${promptText.trimEnd()}\n\n${hint}`;
}

async function prepareScriptedSteps(
	toolName: string,
	steps: StepConfig[],
	cache: ExternalToolCache,
): Promise<PreparedStep[]> {
	const prepared: PreparedStep[] = [];
	for (const [index, step] of steps.entries()) {
		const { server: alias, tool } = parseExternalToolKey(step.call);
		let toolInfo: ServerToolInfo;
		try {
			toolInfo = await cache.getTool(alias, tool);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error ?? "Unknown error");
			throw new ExternalServerError(
				`Tool '${toolName}' step #${index + 1} references unknown tool '${alias}:${tool}' (${message})`,
			);
		}
		const shape = convertJsonSchemaToZodShape(toolInfo.inputSchema);
		const validator = shape ? z.object(shape) : undefined;
		prepared.push({
			alias,
			toolName: tool,
			config: step,
			validator,
		});
	}
	return prepared;
}

async function runScriptedWorkflow(
	toolName: string,
	steps: PreparedStep[],
	params: Record<string, any>,
	configDir: string,
): Promise<{ content: ToolResultContentItem[]; isError?: boolean }>
{
	const context: Record<string, any> = { ...params };
	const aggregated: ToolResultContentItem[] = [];
	let encounteredError = false;

	for (const [index, step] of steps.entries()) {
		if (step.config.requires && !context[step.config.requires]) {
			continue;
		}
		const renderedArgs = step.config.args
			? renderArgs(step.config.args, context)
			: undefined;
		if (step.validator) {
			try {
				step.validator.parse(renderedArgs ?? {});
			} catch (error) {
				throw new Error(
					`Step #${index + 1} (${step.alias}:${step.toolName}) argument validation failed: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
		}
		let response: any;
		try {
			response = await executeExternalTool(
				step.alias,
				step.toolName,
				renderedArgs,
				configDir,
			);
		} catch (error) {
			throw new Error(
				`Step #${index + 1} (${step.alias}:${step.toolName}) failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
		if (response?.isError) {
			encounteredError = true;
		}
		appendStepResult(aggregated, index, step, response);
		if (step.config.saveAs) {
			context[step.config.saveAs] = response;
		}
	}

	if (aggregated.length === 0) {
		aggregated.push({
			type: "text",
			text: `Workflow '${toolName}' completed but produced no step output`,
		});
	}

	return { content: aggregated, isError: encounteredError || undefined };
}

function renderArgs(
	args: Record<string, unknown>,
	context: Record<string, unknown>,
): Record<string, unknown> {
	const rendered: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(args)) {
		rendered[key] = renderValue(value, context);
	}
	return rendered;
}

function renderValue(value: unknown, context: Record<string, unknown>): unknown {
    if (typeof value === "string") {
        // If the value is exactly a single placeholder, return the raw
        // context value without stringifying to preserve types (number, boolean, arrays, objects)
        const fullMatch = value.match(/^\s*\{\{\s*([^}]+)\s*\}\}\s*$/);
        if (fullMatch) {
            const key = fullMatch[1].trim();
            if (Object.prototype.hasOwnProperty.call(context, key)) {
                return (context as any)[key];
            }
        }

        // Otherwise render the template to a string, then attempt light coercion
        // for simple primitives (number/boolean/null). Mixed content stays string.
        const rendered = processTemplate(value, context).result;
        const trimmed = rendered.trim();
        // number: integers and floats, with optional leading '-'
        if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
            const n = Number(trimmed);
            if (Number.isFinite(n)) return n;
        }
        // boolean
        if (trimmed === "true") return true;
        if (trimmed === "false") return false;
        // null
        if (trimmed === "null") return null;
        // As a last resort, keep string
        return rendered;
    }
    if (Array.isArray(value)) {
        return value.map((entry) => renderValue(entry, context));
    }
    if (value && typeof value === "object") {
        return renderArgs(value as Record<string, unknown>, context);
    }
    return value;
}

function appendStepResult(
	content: ToolResultContentItem[],
	index: number,
	step: PreparedStep,
	response: any,
): void {
	if (!step.config.quiet) {
		content.push({
			type: "text",
			text: `Step ${index + 1}: ${step.alias}:${step.toolName}`,
		});
	}
	const items: ToolResultContentItem[] = Array.isArray(response?.content)
		? (response.content as ToolResultContentItem[])
		: [];
	if (items.length > 0) {
		content.push(...items);
		return;
	}
	if (response === undefined || response === null) {
		content.push({ type: "text", text: "(no response)" });
		return;
	}
	if (typeof response === "string") {
		content.push({ type: "text", text: response });
		return;
	}
	if (typeof response === "object") {
		content.push({
			type: "text",
			text: JSON.stringify(response, null, 2),
		});
		return;
	}
	content.push({ type: "text", text: String(response) });
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

function descriptionFromConfig(
	configKey: string,
	toolConfig: Record<string, any>,
): string {
	return toolConfig.description || `${configKey.replace(/_/g, " ")} tool`;
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

function collectAliasRequirementsFromSteps(
	steps: StepConfig[],
	aliasMeta: Map<string, AliasTracker>,
): Map<string, Set<string>> {
	const workflowUsage = new Map<string, Set<string>>();
	for (const step of steps) {
		if (!step || typeof step.call !== "string") {
			continue;
		}
		const { server: alias, tool } = parseExternalToolKey(step.call);
		const meta = aliasMeta.get(alias) ?? {
			registerAll: false,
			explicitTools: new Set<string>(),
		};
		meta.explicitTools.add(tool);
		aliasMeta.set(alias, meta);
		const hintSet = workflowUsage.get(alias) ?? new Set<string>();
		hintSet.add(tool);
		workflowUsage.set(alias, hintSet);
	}
	return workflowUsage;
}

function registerDescribeToolsUtility(
	server: McpServer,
	registeredNames: Set<string>,
	workflows: Map<string, WorkflowDescribeMetadata>,
	cache: ExternalToolCache | undefined,
	configDir?: string,
): void {
	const toolName = "describe_tools";
	if (registeredNames.has(toolName)) {
		return;
	}
	const inputShape: Record<string, z.ZodTypeAny> = {
		workflow: z
			.string()
			.describe("Workflow name to inspect (required unless 'workflows' is provided)")
			.optional(),
		workflows: z
			.array(z.string())
			.describe("Array of workflow names to inspect")
			.optional(),
		aliases: z
			.array(z.string())
			.describe("Optional list of server aliases to filter")
			.optional(),
		search: z
			.string()
			.describe("Full-text filter applied to tool names and descriptions")
			.optional(),
		refresh: z
			.boolean()
			.describe("Force cache refresh before returning results")
			.optional(),
		includeSchemas: z
			.boolean()
			.describe("Include JSON input schemas in the response (default true)")
			.optional(),
		limit: z
			.number()
			.int()
			.positive()
			.max(200)
			.describe("Maximum tools per alias (default 50)")
			.optional(),
	};
	const parser = z
		.object(inputShape)
		.refine(
			(value) =>
				Boolean(value.workflow) ||
				(Boolean(value.workflows) && (value.workflows?.length ?? 0) > 0),
			{
				message: "Specify 'workflow' or 'workflows' to scope describe_tools",
				path: ["workflow"],
			},
		);

	const handler = async (params?: Record<string, any>) => {
		try {
			const parsed = parser.parse(params ?? {});
			const workflowNames = new Set<string>();
			if (parsed.workflow) {
				workflowNames.add(parsed.workflow);
			}
			if (parsed.workflows) {
				for (const name of parsed.workflows) {
					workflowNames.add(name);
				}
			}
			const aliasFilter = new Set(
				(parsed.aliases ?? []).map((alias: string) => alias.trim()).filter(Boolean),
			);
			const includeSchemas = parsed.includeSchemas ?? true;
			const limit = parsed.limit ?? 50;
			const refresh = parsed.refresh ?? false;
			const searchTerm = parsed.search?.toLowerCase().trim();
			const responses: Array<Record<string, any>> = [];

			for (const workflowName of workflowNames) {
				const meta = workflows.get(workflowName);
				if (!meta) {
					throw new Error(
						`Workflow '${workflowName}' is not registered or has no configuration`,
					);
				}
				const aliasList = Array.from(meta.aliases).filter(
					(alias) => aliasFilter.size === 0 || aliasFilter.has(alias),
				);
				if (aliasList.length === 0) {
					responses.push({
						workflow: workflowName,
						runtime: meta.runtime,
						description: meta.description,
						aliases: [],
						warning:
							meta.aliases.size === 0
								? "Workflow does not reference external MCP servers"
								: "No aliases matched the provided filters",
					});
					continue;
				}
				if (!cache || !configDir) {
					responses.push({
						workflow: workflowName,
						runtime: meta.runtime,
						description: meta.description,
						aliases: aliasList.map((alias) => ({
							alias,
							error:
								"Server was started without --config; describe_tools cannot load this alias",
						})),
					});
					continue;
				}
				const aliasEntries: Array<Record<string, any>> = [];
				for (const alias of aliasList) {
					try {
						await cache.ensureAlias(alias, { forceRefresh: refresh });
					} catch (error) {
						aliasEntries.push({
							alias,
							error:
								error instanceof Error
									? error.message
									: String(error ?? "Unknown error"),
						});
						continue;
					}
					const view = cache.getAliasView(alias);
					const tools = view?.tools ?? [];
					let filtered = tools;
					if (searchTerm) {
						filtered = tools.filter((tool) => {
							const haystack = `${tool.name} ${(tool.description ?? "")}`.toLowerCase();
							return haystack.includes(searchTerm);
						});
					}
					const limited = limit > 0 ? filtered.slice(0, limit) : filtered;
					const recommended = meta.scriptedToolHints.get(alias) ?? new Set<string>();
					aliasEntries.push({
						alias,
						mode: meta.autoAliases.has(alias) ? "auto" : "scripted",
						cache: view
							? {
								refreshedAt: new Date(view.refreshedAt).toISOString(),
								stale: view.stale,
								versionHash: view.versionHash,
								toolCount: view.toolCount,
							}
							: undefined,
						lastError: view?.lastError
							? {
								message: view.lastError.message,
								timestamp: new Date(view.lastError.timestamp).toISOString(),
							}
							: undefined,
						truncated: limit > 0 && filtered.length > limited.length,
						tools: limited.map((tool) => ({
							name: tool.name,
							description: tool.description ?? "",
							recommended:
								meta.autoAliases.has(alias) || recommended.has(tool.name),
							inputSchema: includeSchemas ? tool.inputSchema ?? null : undefined,
						})),
					});
				}
				responses.push({
					workflow: workflowName,
					runtime: meta.runtime,
					description: meta.description,
					aliases: aliasEntries,
				});
			}

			const payload = {
				generatedAt: new Date().toISOString(),
				workflows: responses,
			};

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(payload, null, 2),
					},
				],
			};
		} catch (error) {
			return buildToolError(error);
		}
	};

	server.tool(
		toolName,
		"Describe cached MCP tool metadata for a workflow",
		inputShape,
		handler,
	);
	registeredNames.add(toolName);
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
function detectAuthError(error: unknown): string | undefined {
	const message = error instanceof Error ? error.message : String(error ?? "" );
	const normalized = message.toLowerCase();
	const keywords = ["oauth", "authorize", "authorization", "authenticate", "credentials", "login"];
	return keywords.some((keyword) => normalized.includes(keyword)) ? message : undefined;
}

function buildAuthReminder(workflowName: string, alias: string, detail: string) {
	const instructions = `Authentication is required for server '${alias}' (${detail}). Run describe_tools({ "workflow": "${workflowName}", "refresh": true }) or call external_auth_setup to start the login flow.`;
	return {
		content: [{ type: "text", text: instructions }],
	};
}

function registerAuthBootstrapTool(
	server: McpServer,
	registeredNames: Set<string>,
	discoveryCache: ExternalToolCache | undefined,
	aliasMeta: Map<string, AliasTracker>,
	configDir?: string,
): void {
	if (!discoveryCache || aliasMeta.size === 0) {
		return;
	}
	const toolName = "external_auth_setup";
	if (registeredNames.has(toolName)) {
		return;
	}
	const knownAliases = [...aliasMeta.keys()];
	const paramsParser = z
		.object({
			aliases: z.array(z.string()).optional(),
			refresh: z.boolean().optional(),
		})
		.optional();

	const handler = async (params?: Record<string, any>) => {
		if (!configDir) {
			return {
				content: [
					{
						type: "text",
						text: "This tool requires --config to be provided when starting Oplink.",
					},
				],
				isError: true,
			};
		}

		const parsed = paramsParser?.parse(params ?? {}) ?? {};
		const refresh = parsed.refresh ?? true;
		const requested = (parsed.aliases ?? knownAliases).map((alias) => alias.trim()).filter(Boolean);
		const unknown = requested.filter((alias) => !aliasMeta.has(alias));
		if (unknown.length > 0) {
			return {
				content: [
					{
						type: "text",
						text: `Unknown server alias(es): ${unknown.join(", ")}`,
					},
				],
				isError: true,
			};
		}

		const successes: string[] = [];
		const failures: Array<{ alias: string; message: string }> = [];
		for (const alias of requested) {
			try {
				await discoveryCache.ensureAlias(alias, { forceRefresh: refresh });
				successes.push(alias);
			} catch (error) {
				failures.push({
					alias,
					message: error instanceof Error ? error.message : String(error ?? "Unknown error"),
				});
			}
		}

		const summaryLines = [
			`Initialized ${successes.length}/${requested.length} aliases${refresh ? " (forced refresh)" : ""}.`,
			"After this step, run describe_tools({ \"workflow\": \"<name>\" }) in your client so agents can see the latest schemas.",
		];
		if (successes.length > 0) {
			summaryLines.push(`✅ ${successes.join(", ")}`);
		}
		if (failures.length > 0) {
			summaryLines.push(
				`⚠️ Failed aliases:\n${failures
					.map((failure) => `- ${failure.alias}: ${failure.message}`)
					.join("\n")}`,
			);
		}

		return {
			content: [{ type: "text", text: summaryLines.join("\n\n") }],
			isError: failures.length > 0 || undefined,
		};
	};

	server.tool(
		toolName,
		"Warm up OAuth tokens and cached metadata for external MCP servers.",
		{
			aliases: z.array(z.string()).describe("Subset of aliases to initialize").optional(),
			refresh: z.boolean().describe("Force discovery even if cache is warm").optional(),
		},
		handler,
	);
	registeredNames.add(toolName);
}

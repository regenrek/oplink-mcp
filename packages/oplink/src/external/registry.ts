import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { ServerDefinition } from "mcporter";
import { loadEnvForConfigDir } from "./safeload-env";

export type ExternalServerRegistry = {
	configDir: string;
	registryPath: string;
	servers: Map<string, ServerDefinition>;
};

const PLACEHOLDER_REGEX = /\$\{([A-Z0-9_]+)\}/gi;

const BaseServerSchema = z.object({
	description: z.string().optional(),
	package: z.string().optional(),
	env: z.record(z.string()).optional(),
	headers: z.record(z.string()).optional(),
	tokenCacheDir: z.string().optional(),
	clientName: z.string().optional(),
	oauthRedirectUrl: z.string().optional(),
	auth: z.enum(["oauth"]).optional(),
	timeoutMs: z.number().int().positive().optional(),
});

const StdioServerSchema = BaseServerSchema.extend({
	type: z.literal("stdio"),
	command: z.string().min(1, "stdio server requires command"),
	args: z.array(z.string()).optional(),
	cwd: z.string().optional(),
});

const HttpServerSchema = BaseServerSchema.extend({
	type: z.literal("http"),
	url: z.string().url("http server requires valid url"),
});

const ServerEntrySchema = z.union([StdioServerSchema, HttpServerSchema]);

const RegistrySchema = z.object({
	servers: z.record(ServerEntrySchema),
});

export class ExternalServerError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ExternalServerError";
	}
}

export async function loadExternalServerRegistry(configDir: string): Promise<ExternalServerRegistry> {
	if (!configDir) {
		throw new ExternalServerError(
			"External MCP servers require a --config directory containing servers.json",
		);
	}

    const absoluteConfigDir = path.resolve(configDir);

    // Load .env files from the config directory so ${VAR} placeholders can resolve
    // Precedence: shell > .env.{NODE_ENV}.local > .env.{NODE_ENV} > .env.local > .env
    // Shell values are never overridden.
    try {
        loadEnvForConfigDir(absoluteConfigDir);
    } catch (error) {
        // Keep non-fatal: invalid .env should not crash registry loading
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Warning: failed to load .env files from ${absoluteConfigDir}: ${message}`);
    }
	const registryPath = path.join(absoluteConfigDir, "servers.json");

	let raw: string;
	try {
		raw = await fs.readFile(registryPath, "utf8");
	} catch (error) {
		throw new ExternalServerError(
			`Missing MCP server registry at ${registryPath}. Create servers.json with your server definitions.`,
		);
	}

	let parsed: z.infer<typeof RegistrySchema>;
	try {
		parsed = RegistrySchema.parse(JSON.parse(raw));
	} catch (error) {
		throw new ExternalServerError(
			`servers.json at ${registryPath} is invalid: ${error instanceof Error ? error.message : error}`,
		);
	}

	const servers = new Map<string, ServerDefinition>();
	for (const [alias, entry] of Object.entries(parsed.servers)) {
		const normalized = alias.trim();
		if (normalized.length === 0) {
			throw new ExternalServerError(
				"Server aliases must be non-empty strings without whitespace.",
			);
		}
		if (normalized.includes(":")) {
			throw new ExternalServerError(
				`Server alias '${alias}' must not contain ':'. Use the alias without namespaces; Oplink adds the tool suffix automatically.`,
			);
		}
		if (servers.has(normalized)) {
			throw new ExternalServerError(
				`Duplicate server alias '${normalized}' detected in servers.json.`,
			);
		}

		const definition = buildServerDefinition(
			normalized,
			entry,
			absoluteConfigDir,
			registryPath,
		);
		servers.set(normalized, definition);
	}

	if (servers.size === 0) {
		throw new ExternalServerError(
			`No servers declared in ${registryPath}. Add at least one MCP server to register external tools.`,
		);
	}

	return {
		configDir: absoluteConfigDir,
		registryPath,
		servers,
	};
}

function buildServerDefinition(
	alias: string,
	entry: z.infer<typeof ServerEntrySchema>,
	configDir: string,
	registryPath: string,
): ServerDefinition {
	const env = entry.env ? expandObjectPlaceholders(entry.env, alias, registryPath) : undefined;
	const tokenCacheDir = entry.tokenCacheDir
		? path.resolve(configDir, expandPlaceholders(entry.tokenCacheDir, alias, registryPath))
		: undefined;
	const description = entry.description;

	const source = { kind: "local" as const, path: registryPath };

	if (entry.type === "http") {
		const url = expandPlaceholders(entry.url, alias, registryPath);
		const headers = entry.headers
			? expandObjectPlaceholders(entry.headers, alias, registryPath)
			: undefined;
		return {
			name: alias,
			description,
			command: {
				kind: "http",
				url: new URL(url),
				headers,
			},
			env,
			auth: entry.auth,
			tokenCacheDir,
			clientName: entry.clientName,
			oauthRedirectUrl: entry.oauthRedirectUrl,
			source,
		};
	}

	const command = expandPlaceholders(entry.command, alias, registryPath);
	const args = entry.args?.map((arg) => expandPlaceholders(arg, alias, registryPath)) ?? [];
	const cwd = entry.cwd
		? path.resolve(configDir, expandPlaceholders(entry.cwd, alias, registryPath))
		: configDir;

	return {
		name: alias,
		description,
		command: {
			kind: "stdio",
			command,
			args,
			cwd,
		},
		env,
		auth: entry.auth,
		tokenCacheDir,
		clientName: entry.clientName,
		oauthRedirectUrl: entry.oauthRedirectUrl,
		source,
	};
}

function expandObjectPlaceholders(
	values: Record<string, string>,
	alias: string,
	registryPath: string,
): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [key, value] of Object.entries(values)) {
		result[key] = expandPlaceholders(value, alias, registryPath);
	}
	return result;
}

function expandPlaceholders(value: string, alias: string, registryPath: string): string {
	return value.replace(PLACEHOLDER_REGEX, (match, varName) => {
		const actual = process.env[varName];
		if (actual === undefined) {
			throw new ExternalServerError(
				`Missing environment variable '${varName}' referenced by server '${alias}' in ${registryPath}`,
			);
		}
		return actual;
	});
}

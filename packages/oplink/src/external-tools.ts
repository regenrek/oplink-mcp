import path from "node:path";
import { createRuntime, type Runtime, type ServerToolInfo } from "mcporter";
import { getPackageInfo } from "./utils";
import {
	ExternalServerError,
	loadExternalServerRegistry,
	type ExternalServerRegistry,
} from "./external/registry";

export { ExternalServerError } from "./external/registry";

const registryCache = new Map<string, Promise<ExternalServerRegistry>>();
const runtimeCache = new Map<string, Promise<Runtime>>();

function resolveConfigKey(configDir: string | undefined): string {
	if (!configDir) {
		throw new ExternalServerError(
			"External MCP servers require a --config directory so Oplink can load servers.json",
		);
	}
	return path.resolve(configDir);
}

async function getRegistry(configDir: string): Promise<ExternalServerRegistry> {
	const key = resolveConfigKey(configDir);
	const existing = registryCache.get(key);
	if (existing) {
		return existing;
	}
	const pending = loadExternalServerRegistry(key);
	registryCache.set(key, pending);
	try {
		return await pending;
	} catch (error) {
		registryCache.delete(key);
		throw error;
	}
}

async function getRuntime(configDir: string): Promise<Runtime> {
	const key = resolveConfigKey(configDir);
	const existing = runtimeCache.get(key);
	if (existing) {
		return existing;
	}

	const pending = (async () => {
		const registry = await getRegistry(key);
		const definitions = Array.from(registry.servers.values());
		if (definitions.length === 0) {
			throw new ExternalServerError(
				`servers.json at ${registry.registryPath} does not define any MCP servers`,
			);
		}

		const pkg = getPackageInfo();

		return createRuntime({
			servers: definitions,
			clientInfo: {
				name: pkg?.name ?? "oplink",
				version: pkg?.version ?? "0.0.0",
			},
		});
	})();

	runtimeCache.set(key, pending);
	try {
		return await pending;
	} catch (error) {
		runtimeCache.delete(key);
		throw error;
	}
}

export async function ensureExternalServer(
	alias: string,
	configDir: string,
): Promise<void> {
	const registry = await getRegistry(configDir);
	if (!registry.servers.has(alias)) {
		throw new ExternalServerError(
			`Server alias '${alias}' is not defined in ${registry.registryPath}`,
		);
	}
}

export async function listExternalServerTools(
	alias: string,
	configDir: string,
	includeSchema = true,
): Promise<ServerToolInfo[]> {
	await ensureExternalServer(alias, configDir);
	const runtime = await getRuntime(configDir);
	return runtime.listTools(alias, { includeSchema });
}

export async function executeExternalTool(
	alias: string,
	toolName: string,
	args: Record<string, unknown> | undefined,
	configDir: string,
): Promise<unknown> {
	await ensureExternalServer(alias, configDir);
	const runtime = await getRuntime(configDir);
	return runtime.callTool(alias, toolName, { args });
}

export function resetExternalRuntimeCache(): void {
	runtimeCache.clear();
	registryCache.clear();
}

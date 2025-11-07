import process from "node:process";
import { type LoadConfigOptions, loadConfig as loadC12Config } from "c12";
import { createJiti } from "jiti";
import { resolve } from "pathe";
import type { OplinkConfig, ResolvedOplinkConfig } from "../@types/config";
import { logger } from "./logger";

const defaults: LoadConfigOptions<OplinkConfig> = {
	name: "oplink", // Name of the config file (oplink.config.ts, oplink.config.js, etc.)
	configFile: "oplink.config", // Base name without extension
	rcFile: false, // Disable .oplinkrc lookup
	globalRc: false, // Disable global rc lookup
	packageJson: false, // Disable package.json lookup
	dotenv: true, // Load .env files
	jiti: createJiti(process.cwd(), {
		interopDefault: true,
	}),
};

export async function loadOplinkConfig(
	cwd: string = process.cwd(),
): Promise<ResolvedOplinkConfig> {
	const resolvedCwd = resolve(cwd);
	logger.debug(`Loading OPLINK config from: ${resolvedCwd}`);

	const loadedC12Result = await loadC12Config<OplinkConfig>({
		...defaults,
		cwd: resolvedCwd,
	});

	// Construct the ResolvedOplinkConfig object from c12's result
	const resolvedConfig: ResolvedOplinkConfig = {
		config: loadedC12Result.config,
		configFile: loadedC12Result.configFile,
		layers: loadedC12Result.layers,
		cwd: resolvedCwd,
	};

	if (!resolvedConfig.config && !resolvedConfig.configFile) {
		logger.debug("No oplink.config file found during load attempt.");
		// Return the structure indicating no file was found
		return resolvedConfig; // Already contains cwd and undefined config/configFile
	}

	logger.debug(
		`Loaded config from: ${resolvedConfig.configFile || "unknown source"}`,
	);
	logger.debug("Config content:", resolvedConfig.config);

	return resolvedConfig;
}

// Helper to check if a config file was actually loaded
export function configFileExists(config: ResolvedOplinkConfig): boolean {
	return !!config.configFile;
}

// Gets config or throws if not found
export async function loadOplinkConfigOrFail(
	cwd?: string,
): Promise<ResolvedOplinkConfig> {
	const config = await loadOplinkConfig(cwd);
	if (!configFileExists(config)) {
		// Maybe provide a more helpful error message, suggesting `oplink init`
		throw new Error(
			`OPLINK configuration file (e.g., oplink.config.ts) not found in ${config.cwd}. Please run 'oplink init' or create one manually.`,
		);
	}
	return config;
}

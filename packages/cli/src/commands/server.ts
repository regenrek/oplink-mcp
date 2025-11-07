import { promises as fsp } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "pathe";

import { defineCommand } from "citty";
import { consola } from "consola";

import { createMcpServer, loadAndMergeConfig, startServer } from "@oplink/core";

import { logger } from "../utils/logger";
import { cwdArgs, logLevelArgs } from "./_shared";

async function getPackageVersion(): Promise<string> {
	const __filename = fileURLToPath(import.meta.url);
	const packageJsonPath = join(dirname(__filename), "..", "..", "package.json");
	try {
		const pkgContent = await fsp.readFile(packageJsonPath, "utf8");
		const pkg = JSON.parse(pkgContent);
		return pkg.version || "unknown";
	} catch (error) {
		logger.error("Failed to read package.json:", error);
		return "unknown";
	}
}

export default defineCommand({
	meta: {
		name: "server",
		description: "Start the MCP server process",
	},
	args: {
		...cwdArgs,
		...logLevelArgs,
		force: {
			type: "boolean",
			description:
				"Override existing preset file or directory in .mcp-workflows",
		},
		preset: {
			type: "string",
			description:
				"Comma-separated list of presets to use (e.g., thinking,code). Defaults to 'thinking' if no preset or config is specified.",
		},
		config: {
			type: "string",
			description: "Path to a specific user configuration file or directory",
		},
		presetsDir: {
			type: "string",
			description: "Directory containing preset YAML files",
		},
	},
	async run(ctx) {
		// Ensure no logs go to STDOUT in server mode; MCP JSON must own STDOUT
		// Route consola output to STDERR for the lifetime of this command
		// This helps silence third-party libs that use consola under the hood
		// without interfering with the JSON-RPC stream on STDOUT.
		try {
			// @ts-expect-error consola runtime options are available at runtime
			consola.options = { ...(consola as any).options, stdout: process.stderr, stderr: process.stderr };
		} catch {}

		// Prefer STDERR for any diagnostic output
		console.error("Starting MCP server...");

		const configPath = ctx.args.config;
		let presets: string[] = [];

		if (ctx.args.preset) {
			presets = ctx.args.preset
				.split(",")
				.map((p) => p.trim())
				.filter(Boolean);
		}

		if (presets.length === 0 && !configPath) {
			console.error(
				"No preset or config specified, defaulting to 'thinking' preset.",
			);
			presets = ["thinking"];
		}

		try {
			const version = await getPackageVersion();
			if (version === "unknown") {
				console.error("Could not determine package version.");
			}

			// Determine CLI's own dist/presets directory
			const cliFile = fileURLToPath(import.meta.url);
			const cliDir = dirname(cliFile);
			const cliDistPresetsDir = join(cliDir, "../presets");

			// Use explicit --presets-dir if provided, else default to CLI's dist/presets
			const presetsDirArg = ctx.args.presetsDir as string | undefined;
			const presetsDir = presetsDirArg || cliDistPresetsDir;

			console.error(
				`Loading configuration with presets: ${presets.join(", ")}${configPath ? ` and config: ${configPath}` : ""}`,
			);
			const finalConfig = loadAndMergeConfig(presets, configPath, presetsDir);

			// During server creation we may talk to external MCP servers via mcporter.
			// Some libraries may still write to STDOUT; temporarily mirror STDOUT to STDERR
			// to keep the transport stream clean until we connect.
			const originalWrite = process.stdout.write.bind(process.stdout);
			(process.stdout as any).write = function chunkToStderr(chunk: any, encoding?: any, cb?: any) {
				return (process.stderr as any).write(chunk, encoding, cb);
			};

			let server: Awaited<ReturnType<typeof createMcpServer>>;
			try {
				server = await createMcpServer(finalConfig, version, {
					configDir: configPath,
				});
			} finally {
				(process.stdout as any).write = originalWrite;
			}

			await startServer(server!, presets, configPath);
		} catch (error) {
			console.error("Failed to start MCP server:", error);
			process.exit(1);
		}
	},
});

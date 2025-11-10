import { promises as fsp } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "pathe";

import { defineCommand } from "citty";
import { consola } from "consola";
// Prefer workspace import; fallback to monorepo dist when running tests
async function loadCore() {
    try {
        return await import("@oplink/core");
    } catch {
        const { fileURLToPath } = await import("node:url");
        const { dirname, join } = await import("pathe");
        const here = fileURLToPath(import.meta.url);
        const fallback = join(dirname(here), "../../../oplink/dist/index.mjs");
        return await import(fallback);
    }
}

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
		config: {
			type: "string",
			description: "Path to a specific user configuration file or directory",
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

		try {
			const version = await getPackageVersion();
			if (version === "unknown") {
				console.error("Could not determine package version.");
			}

			if (ctx.args.logLevel) {
				process.env.OPLINK_LOG_LEVEL = String(ctx.args.logLevel);
			}
				const core = await loadCore();
				const finalConfig = core.loadAndMergeConfig(configPath);

			// During server creation we may talk to external MCP servers via mcporter.
			// Some libraries may still write to STDOUT; temporarily mirror STDOUT to STDERR
			// to keep the transport stream clean until we connect.
			const originalWrite = process.stdout.write.bind(process.stdout);
			(process.stdout as any).write = function chunkToStderr(chunk: any, encoding?: any, cb?: any) {
				return (process.stderr as any).write(chunk, encoding, cb);
			};

				let server: Awaited<ReturnType<typeof core.createMcpServer>> | null = null;
				try {
					server = await core.createMcpServer(finalConfig, version, {
						configDir: configPath,
					});
				} finally {
					(process.stdout as any).write = originalWrite;
				}

			if (!server) {
				throw new Error("MCP server failed to initialize");
			}
				await core.startServer(server, configPath);
		} catch (error) {
			console.error("Failed to start MCP server:", error);
			process.exit(1);
		}
	},
});

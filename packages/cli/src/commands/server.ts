import { promises as fsp } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "pathe";

import { defineCommand } from "citty";
import { consola } from "consola";

import { logger } from "../utils/logger";
import { cwdArgs, logLevelArgs } from "./_shared";

function envFlag(name: string, defaultValue = false): boolean {
	const raw = process.env[name];
	if (raw === undefined) return defaultValue;
	return /^(1|true|yes|on)$/i.test(raw.trim());
}

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

    // Prefer STDERR for any diagnostic output (verbose only)
    if (process.env.OPLINK_LOG_LEVEL === 'verbose') {
      console.error("Starting MCP server...");
    }

		const configPath = ctx.args.config;

		try {
        const version = await getPackageVersion();
        if (version === "unknown" && process.env.OPLINK_LOG_LEVEL === 'verbose') {
          console.error("Could not determine package version.");
        }

			if (ctx.args.logLevel) {
				process.env.OPLINK_LOG_LEVEL = String(ctx.args.logLevel);
			}
                // Dynamically import core at runtime to avoid bundling it into the CLI
                const { createMcpServer, loadAndMergeConfig, startServer } = await import("@oplink/core");
                const finalConfig = loadAndMergeConfig(configPath);

			// During server creation we may talk to external MCP servers via mcporter.
			// Some libraries may still write to STDOUT; temporarily mirror STDOUT to STDERR
			// to keep the transport stream clean until we connect.
			const originalWrite = process.stdout.write.bind(process.stdout);
			(process.stdout as any).write = function chunkToStderr(chunk: any, encoding?: any, cb?: any) {
				return (process.stderr as any).write(chunk, encoding, cb);
			};

				let server: Awaited<ReturnType<typeof createMcpServer>> | null = null;
                try {
                    const skip = /^(1|true|yes)$/i.test(String(process.env.OPLINK_SKIP_SCRIPTED_ERRORS || ""));
                    const autoExternal = envFlag("OPLINK_AUTO_REGISTER_EXTERNAL_TOOLS");
                    const includeInfo = envFlag("OPLINK_INFO_TOOL");
                    server = await createMcpServer(finalConfig, version, {
                      configDir: configPath,
                      skipScriptedErrors: skip,
                      autoRegisterExternalTools: autoExternal,
                      includeInfoTool: includeInfo,
                    });
                } finally {
                    (process.stdout as any).write = originalWrite;
                }

			if (!server) {
				throw new Error("MCP server failed to initialize");
			}
            await startServer(server, configPath);
		} catch (error) {
			console.error("Failed to start MCP server:", error);
			process.exit(1);
		}
	},
});

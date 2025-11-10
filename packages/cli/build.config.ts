import type { InputPluginOption } from "rollup";
import alias from "@rollup/plugin-alias";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "pathe";
import { visualizer } from "rollup-plugin-visualizer";
import { defineBuildConfig } from "unbuild";

const isAnalysingSize = process.env.BUNDLE_SIZE === "true";

export default defineBuildConfig({
	declaration: !isAnalysingSize,
	failOnWarn: true,
	externals: [], // inline workspace deps like @oplink/core
	entries: [
		"src/index",
		// Bundle JSON Schemas used by `oplink validate`
		{
			builder: "copy",
			input: "../../schema",
			outDir: "dist/schema",
			pattern: "*.json",
		},
		// Also include local helper meta-schema file
		{
			builder: "copy",
			input: "schema",
			outDir: "dist/schema",
			pattern: "json-schema-2020-12.json",
		},
	],
	hooks: {
	"rollup:options"(ctx, options) {
			// bundle yaml files
			if (!options.plugins) {
				options.plugins = [];
			}
			const plugins = options.plugins as InputPluginOption[];

			// Prefer local workspace core build when available to avoid dynamic imports
			try {
				const here = dirname(fileURLToPath(import.meta.url));
				const coreDist = resolve(here, "../../oplink/dist/index.mjs");
				const coreSrc = resolve(here, "../../oplink/src/index.ts");
				const replacement = existsSync(coreDist)
					? coreDist
					: existsSync(coreSrc)
						? coreSrc
						: undefined;
				if (replacement) {
					plugins.unshift(
						alias({ entries: [{ find: "@oplink/core", replacement }] }),
					);
				}
			} catch {}

			if (isAnalysingSize) {
				plugins.unshift(visualizer({ template: "raw-data" }));
			}
		},
	},
	rollup: {
		dts: {
			respectExternal: false,
		},
		inlineDependencies: true,
		resolve: {
			exportConditions: ["production", "node"],
		},
	},
	externals: [
		"@nuxt/test-utils",
		"fsevents",
		"node:url",
		"node:buffer",
		"node:path",
		"node:child_process",
		"node:process",
		"node:path",
		"node:os",
	],
});

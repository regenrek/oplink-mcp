import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		coverage: {
			include: ["src/**/*.ts"],
			exclude: ["src/@types/**"],
		},
	},
  // Ensure AJV can be resolved/optimized in Vitest
  optimizeDeps: {
    include: ["ajv", "ajv-formats"],
  },
  ssr: {
    noExternal: ["ajv", "ajv-formats"],
  },
});

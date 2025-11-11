import { defineConfig } from 'rolldown';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  input: {
    index: 'src/index.ts',
  },
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: true,
    entryFileNames: '[name].mjs',
    chunkFileNames: 'shared/[name].[hash].mjs',
    preserveModules: true,
    preserveModulesRoot: 'src',
  },
  treeshake: true,
  // Keep Node built-ins and certain CJS deps external so Node resolves them at runtime
  external: (
    id: string,
  ) =>
    id.startsWith('node:') ||
    id.includes('/node_modules/') ||
    id.startsWith('@oplink/core') ||
    // Common built-ins sometimes referenced without node: prefix by transitive deps
    id === 'fs' ||
    id === 'fs/promises' ||
    id === 'path' ||
    id === 'url' ||
    id === 'os' ||
    id === 'child_process' ||
    id === 'process' ||
    id === 'tty' ||
    id === 'util' ||
    id === 'stream' ||
    id === 'crypto' ||
    id === 'assert' ||
    // Transitive libs that embed require() at runtime
    id.startsWith('@iarna/toml') ||
    id.startsWith('jiti') ||
    id.startsWith('giget') ||
    id.startsWith('@modelcontextprotocol/sdk') ||
    id.startsWith('cross-spawn') || id.includes('/cross-spawn/') || id.includes('cross-spawn'),
  resolve: {},
  plugins: [
    {
      name: 'externalize-bare-deps',
      resolveId(id, importer) {
        // Do not externalize entry points or relative/absolute/virtual ids
        if (!importer) return null;
        if (id.startsWith('.') || id.startsWith('/') || id.startsWith('\0')) return null;
        // Externalize all bare specifiers (node_modules and workspace deps)
        return { id, external: true } as any;
      },
    },
  ],
});

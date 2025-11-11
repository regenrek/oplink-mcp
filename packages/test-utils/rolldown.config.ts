import { defineConfig } from 'rolldown';

export default defineConfig({
  input: {
    index: 'src/index.ts',
  },
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: true,
    entryFileNames: '[name].mjs',
  },
  treeshake: true,
  external: (id: string) =>
    id.startsWith('node:') ||
    id === 'fs' || id === 'path' || id === 'child_process' || id === 'os' || id === 'util' || id === 'process',
  plugins: [
    {
      name: 'externalize-bare-deps',
      resolveId(id, importer) {
        if (!importer) return null;
        if (id.startsWith('.') || id.startsWith('/') || id.startsWith('\0')) return null;
        return { id, external: true } as any;
      },
    },
  ],
});

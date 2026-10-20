import { defineConfig } from 'tsdown'

// Spike: mirrors the root workspace host layout for standalone builds. During
// a full `pnpm run build:lib:host` this file replaces the workspace config for
// this package, so typert artifacts are generated separately via the focused
// generator pass (see the spike notes).
export default defineConfig({
  entry: ['lib/types/index.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
})

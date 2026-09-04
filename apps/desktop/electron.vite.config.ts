import { resolve } from 'node:path';
import vue from '@vitejs/plugin-vue';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

const workspacePkgs = [
  '@agent-deck/core',
  '@agent-deck/adapters-contract',
  '@agent-deck/adapters-fake',
  '@agent-deck/adapters-dsh',
  '@agent-deck/orchestration',
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePkgs })],
    resolve: {
      alias: {
        '@agent-deck/core': resolve('../../packages/core/src/index.ts'),
        '@agent-deck/adapters-contract': resolve('../../packages/adapters-contract/src/index.ts'),
        '@agent-deck/adapters-fake': resolve('../../packages/adapters-fake/src/index.ts'),
        '@agent-deck/adapters-dsh': resolve('../../packages/adapters-dsh/src/index.ts'),
        '@agent-deck/orchestration': resolve('../../packages/orchestration/src/index.ts'),
      },
    },
    build: {
      rollupOptions: { input: { index: resolve('src/main/index.ts') } },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePkgs })],
    resolve: {
      alias: {
        '@agent-deck/core': resolve('../../packages/core/src/index.ts'),
      },
    },
    build: {
      rollupOptions: { input: { index: resolve('src/preload/index.ts') } },
    },
  },
  renderer: {
    root: resolve('src/renderer'),
    plugins: [vue()],
    resolve: {
      alias: {
        '@agent-deck/core': resolve('../../packages/core/src/index.ts'),
      },
    },
    build: {
      rollupOptions: { input: { index: resolve('src/renderer/index.html') } },
    },
  },
});

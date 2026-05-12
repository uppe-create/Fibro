import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { getProductionAuthError } from './src/lib/auth-mode';

export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const productionAuthError = getProductionAuthError(env, command === 'build');
  if (productionAuthError) {
    throw new Error(`[security] ${productionAuthError}`);
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // Keep this toggle so local agent edits can disable HMR when needed.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    test: {
      environment: 'node',
      exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
      globals: true,
    },
  };
});

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { getProductionAuthError } from './src/lib/auth-mode';

export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const productionAuthError = getProductionAuthError(env, command === 'build');
  if (productionAuthError) {
    throw new Error(`[security] ${productionAuthError}`);
  }

  return {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('\\react\\') || id.includes('/react/') || id.includes('react-dom') || id.includes('scheduler')) return 'react-vendor';
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('jspdf') || id.includes('pdfjs-dist')) return 'pdf';
            if (id.includes('html5-qrcode') || id.includes('qrcode.react')) return 'qr';
            if (id.includes('html-to-image') || id.includes('html2canvas')) return 'print';
            return 'vendor';
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      // Keep this toggle so local agent edits can disable HMR when needed.
      hmr: process.env.DISABLE_HMR !== 'true'
    },
    test: {
      environment: 'node',
      exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
      globals: true
    }
  };
});

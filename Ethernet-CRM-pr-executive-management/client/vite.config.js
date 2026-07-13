import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 3000,
    proxy: {
      // Proxy uploads in dev to avoid CORS when fetching compressed file from api.madhuram.enterprises
      '/api-uploads': {
        target: 'https://api.madhuram.enterprises',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-uploads/, '/uploads'),
      },
    },
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
  worker: {
    format: 'es',
  },
  build: {
    rollupOptions: {
      output: {
        // Ensure worker files are properly handled
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
})

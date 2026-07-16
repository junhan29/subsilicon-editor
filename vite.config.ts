import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync(resolve(__dirname, './package.json'), 'utf-8'))

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_NAME__: JSON.stringify(pkg.productName || pkg.name),
  },
  resolve: {
    alias: {
      '@editor': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'zustand'],
          xyflow: ['@xyflow/react'],
          radix: ['@radix-ui/react-dialog', '@radix-ui/react-tabs', '@radix-ui/react-label', '@radix-ui/react-slot'],
          tiptap: ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-link', '@tiptap/extension-placeholder'],
          utils: ['clsx', 'tailwind-merge', 'class-variance-authority', 'uuid', 'jszip'],
        },
      },
    },
    target: 'es2020',
    assetsInlineLimit: 4096,
    brotliSize: true,
  },
  server: {
    port: 5173,
  },
})

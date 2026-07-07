import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@editor': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        web: resolve(__dirname, 'web.html'),
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
    polyfillModulePreload: false,
    assetsInlineLimit: 4096,
    brotliSize: true,
  },
  server: {
    port: 5173,
  },
})

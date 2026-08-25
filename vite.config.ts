import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync, existsSync } from 'fs'
// @ts-ignore - CommonJS require 在 Vite/Node ESM interop 下可用
import buildVersion from './desktop/build-version.cjs'

const pkg = JSON.parse(readFileSync(resolve(__dirname, './package.json'), 'utf-8'))
// 单源 appName / version：永远以 desktop/build-version.cjs 为真
const APP_VERSION = String(buildVersion.VERSION || pkg.version)
const APP_NAME = String(
  (pkg.build && (pkg.build as any).productName) ||
  pkg.productName ||
  pkg.displayName ||
  pkg.name
)

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_NAME__: JSON.stringify(APP_NAME),
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

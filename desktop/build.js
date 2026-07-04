#!/usr/bin/env node

const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs')

const outDir = path.resolve(__dirname, '../.electron')

// 确保 .electron 目录存在
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

// 构建主进程
esbuild.build({
  entryPoints: [path.resolve(__dirname, '../desktop/main.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: path.join(outDir, 'main.js'),
  external: ['electron', '@electron/*'],
  format: 'cjs',
  sourcemap: true,
  minify: false,
}).then(() => {
  console.log('✅ Electron main process built')
}).catch((err) => {
  console.error('❌ Failed to build main process:', err)
  process.exit(1)
})

// 构建 preload
esbuild.build({
  entryPoints: [path.resolve(__dirname, '../desktop/preload.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: path.join(outDir, 'preload.js'),
  external: ['electron', '@electron/*'],
  format: 'cjs',
  sourcemap: true,
  minify: false,
}).then(() => {
  console.log('✅ Electron preload built')
}).catch((err) => {
  console.error('❌ Failed to build preload:', err)
  process.exit(1)
})
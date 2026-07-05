#!/usr/bin/env node

const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs')

const outDir = path.resolve(__dirname, '.')

async function build() {
  await Promise.all([
    esbuild.build({
      entryPoints: [path.resolve(__dirname, 'main.ts')],
      bundle: true,
      platform: 'node',
      target: 'node20',
      outfile: path.join(outDir, 'main.cjs'),
      external: ['electron', '@electron/*'],
      format: 'cjs',
      sourcemap: false,
      minify: true,
    }),
    esbuild.build({
      entryPoints: [path.resolve(__dirname, 'preload.ts')],
      bundle: true,
      platform: 'node',
      target: 'node20',
      outfile: path.join(outDir, 'preload.cjs'),
      external: ['electron', '@electron/*'],
      format: 'cjs',
      sourcemap: false,
      minify: true,
    }),
  ])
  console.log('Electron main + preload built')
}

build().catch((err) => {
  console.error('Build failed:', err)
  process.exit(1)
})

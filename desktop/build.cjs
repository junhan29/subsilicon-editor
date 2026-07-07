const esbuild = require('esbuild')
const path = require('path')

const isDev = process.env.NODE_ENV === 'development'

const buildOptions = {
  entryPoints: ['desktop/main.cjs', 'desktop/preload.cjs'],
  outdir: 'desktop',
  platform: 'node',
  target: 'node20',
  bundle: false,
  minify: !isDev,
  sourcemap: isDev,
  packages: 'external',
}

esbuild.build(buildOptions).then(() => {
  console.log('Electron main process built successfully')
}).catch((error) => {
  console.error('Electron build failed:', error)
  process.exit(1)
})
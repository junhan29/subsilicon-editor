#!/bin/sh
':' //# -*- mode: js -*-
':' //; command -v node >/dev/null 2>&1 || { echo "Node.js not found in PATH. Please install Node.js first." >&2; exit 1; }
':' //; SCRIPT="$0"; while [ -L "$SCRIPT" ]; do SCRIPT_DIR=$(cd -P "$(dirname "$SCRIPT")" && pwd); SCRIPT=$(readlink "$SCRIPT"); case $SCRIPT in /*) ;; *) SCRIPT="$SCRIPT_DIR/$SCRIPT";; esac; done; SCRIPT_DIR=$(cd -P "$(dirname "$SCRIPT")" && pwd)
':' //; ROOT_DIR=$(cd -P "$SCRIPT_DIR/.." && pwd)
':' //; export PATH="$ROOT_DIR/node_modules/.bin:$PATH"
':' //; exec node --experimental-modules --experimental-vm-modules --experimental-specifier-resolution=node --experimental-json-modules --experimental-wasm-modules --experimental-top-level-await --no-warnings --max-old-space-size=4096 "$0" "$@"
// The above are shell polyglot lines and ignored by Node when used as a JS file via node
// They are compatible with shell because ':' is the shell no-op; the semicolons and exec
// switch control to node before JS is parsed in shell mode.

'use strict';

const path = require('path');
const fs = require('fs');

function resolveRoot(...p) { return path.resolve(__dirname, '..', ...p); }
function resolveDesktop(...p) { return path.resolve(__dirname, ...p); }

function ensureEsbuild() {
  try {
    return require('esbuild');
  } catch (_) {
    try {
      return require(resolveRoot('node_modules', 'esbuild'));
    } catch (e) {
      console.error('[desktop:build] 缺少 esbuild，请先在项目根目录执行 npm install');
      process.exit(1);
    }
  }
}

const ELECTRON_EXTERNALS = [
  'electron', 'electron-updater',
  'original-fs',
  'node:path', 'node:fs', 'node:child_process', 'node:process', 'node:url',
];

const TS_EXTERNALS = [
  ...ELECTRON_EXTERNALS,
  'path', 'fs', 'fs/promises', 'child_process', 'process', 'url', 'os', 'util', 'events', 'stream', 'buffer', 'crypto', 'http', 'https', 'net', 'tls', 'zlib', 'readline', 'assert',
];

async function compileMain(outDir) {
  const esbuild = ensureEsbuild();
  const entry = resolveDesktop('main.ts');
  const out = path.join(outDir, 'main.cjs');
  await esbuild.build({
    entryPoints: [entry],
    outfile: out,
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    sourcemap: false,
    minify: false,
    keepNames: true,
    mainFields: ['main', 'module'],
    external: TS_EXTERNALS,
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    },
    logLevel: 'warning',
  });
  const stat = fs.statSync(out);
  console.log(`✓ main.ts → main.cjs  (${(stat.size / 1024).toFixed(1)} KB)`);
}

async function compilePreload(outDir) {
  const esbuild = ensureEsbuild();
  const entry = resolveDesktop('preload.ts');
  const out = path.join(outDir, 'preload.cjs');
  await esbuild.build({
    entryPoints: [entry],
    outfile: out,
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    sourcemap: false,
    minify: false,
    keepNames: true,
    external: TS_EXTERNALS,
    logLevel: 'warning',
  });
  const stat = fs.statSync(out);
  console.log(`✓ preload.ts → preload.cjs  (${(stat.size / 1024).toFixed(1)} KB)`);
}

function copyIcon(outDir) {
  const iconPath = resolveRoot('assets/icon.png');
  const buildDir = resolveRoot('build');
  const outIcon = path.join(buildDir, 'icon.png');
  if (fs.existsSync(iconPath)) {
    fs.mkdirSync(buildDir, { recursive: true });
    fs.copyFileSync(iconPath, outIcon);
    console.log('✓ icon.png → build/icon.png');
  } else if (fs.existsSync(outIcon)) {
    console.log('· icon.png 已在 build/icon.png，跳过复制');
  } else {
    console.warn('· 找不到 icon.png，请放在 assets/icon.png（可选）');
  }
}

async function main() {
  const startTime = Date.now();
  console.log('🚀 SubSilicon Editor Desktop Build (TS → CJS)\n');
  console.log('  源文件：  desktop/main.ts, desktop/preload.ts');
  console.log('  输出目录：desktop/');
  console.log('');

  const outDir = resolveDesktop('.');
  fs.mkdirSync(outDir, { recursive: true });

  try {
    await compileMain(outDir);
    await compilePreload(outDir);
  } catch (e) {
    console.error('\n❌ ESBuild 编译失败：', e.message || e);
    process.exit(1);
  }

  copyIcon(outDir);

  const elapsed = Date.now() - startTime;
  console.log(`\n✅ 桌面端编译完成 (${elapsed}ms)`);
  console.log('  ├─ main.cjs        (Electron Main)');
  console.log('  └─ preload.cjs     (Preload)');
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { main, compileMain, compilePreload };

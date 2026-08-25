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

'use strict'

const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { execSync } = require('child_process')

function resolveRoot(...p) { return path.resolve(__dirname, '..', ...p) }
function resolveDesktop(...p) { return path.resolve(__dirname, ...p) }

const GREEN = (s) => `\x1b[32m${s}\x1b[0m`
const RED   = (s) => `\x1b[31m${s}\x1b[0m`
const YEL   = (s) => `\x1b[33m${s}\x1b[0m`
const BOLD  = (s) => `\x1b[1m${s}\x1b[0m`

// ================================================================
// V2.2 Preflight：单源版本号强制同步
// 必须在 ESBuild 编译 / Electron-builder 打包 之前执行
// ================================================================
function preflightPatch() {
  const v = require('./build-version.cjs')
  const rootPkgPath = resolveRoot('package.json')

  // 1. 强制覆写 package.json.version → build-version.VERSION（永远防止漂移）
  const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'))
  if (pkg.version !== v.VERSION) {
    pkg.version = v.VERSION
    fs.writeFileSync(rootPkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
    console.log(`${YEL('[preflight]')} package.json.version 已强制同步为 ${v.VERSION}`)
  }

  // 2. 写入 src/build-info.json（前端 / Electron 主进程运行时统一读此源）
  const buildInfo = {
    version:    v.VERSION,
    semver:     v.SEMVER,
    buildNumber:v.BUILD_NUMBER,
    commit:     v.COMMIT,
    buildTime:  v.BUILD_TIME,
    channel:    v.CHANNEL,
    appName:    (pkg.build && pkg.build.productName) || pkg.productName || pkg.displayName || pkg.name || 'SubSilicon Editor',
  }
  const infoPath = resolveRoot('src', 'build-info.json')
  fs.mkdirSync(path.dirname(infoPath), { recursive: true })
  fs.writeFileSync(infoPath, JSON.stringify(buildInfo, null, 2) + '\n', 'utf-8')

  // 3. 绿色输出
  console.log(`${GREEN('[preflight]')} ${BOLD(`version=${v.VERSION}`)}  semver=${v.SEMVER}  channel=${v.CHANNEL}  build=${v.BUILD_NUMBER}  commit=${v.COMMIT}`)
  console.log(`${GREEN('[preflight]')} src/build-info.json 已生成`)

  // 也同步生成 dist/build-info.json（若 dist 存在），方便运行时静态读；前端主要走 import。
  const distInfoPath = resolveRoot('dist', 'build-info.json')
  if (fs.existsSync(resolveRoot('dist'))) {
    fs.writeFileSync(distInfoPath, JSON.stringify(buildInfo, null, 2) + '\n', 'utf-8')
  }

  return { v, pkg, buildInfo }
}

const ELECTRON_EXTERNALS = [
  'electron', 'electron-updater',
  'original-fs',
  'node:path', 'node:fs', 'node:child_process', 'node:process', 'node:url',
]
const TS_EXTERNALS = [
  ...ELECTRON_EXTERNALS,
  'path', 'fs', 'fs/promises', 'child_process', 'process', 'url', 'os', 'util', 'events', 'stream', 'buffer', 'crypto', 'http', 'https', 'net', 'tls', 'zlib', 'readline', 'assert',
]

function ensureEsbuild() {
  try { return require('esbuild') } catch (_) {
    try { return require(resolveRoot('node_modules', 'esbuild')) }
    catch (e) {
      console.error('[desktop:build] 缺少 esbuild，请先在项目根目录执行 npm install')
      process.exit(1)
    }
  }
}

async function compileMain(outDir) {
  const esbuild = ensureEsbuild()
  const entry = resolveDesktop('main.ts')
  const out = path.join(outDir, 'main.cjs')
  await esbuild.build({
    entryPoints: [entry], outfile: out, bundle: true, platform: 'node', target: 'node18',
    format: 'cjs', sourcemap: false, minify: false, keepNames: true,
    mainFields: ['main', 'module'], external: TS_EXTERNALS,
    define: { 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production') },
    logLevel: 'warning',
  })
  const stat = fs.statSync(out)
  console.log(`✓ main.ts → main.cjs  (${(stat.size / 1024).toFixed(1)} KB)`)
}

async function compilePreload(outDir) {
  const esbuild = ensureEsbuild()
  const entry = resolveDesktop('preload.ts')
  const out = path.join(outDir, 'preload.cjs')
  await esbuild.build({
    entryPoints: [entry], outfile: out, bundle: true, platform: 'node', target: 'node18',
    format: 'cjs', sourcemap: false, minify: false, keepNames: true,
    external: TS_EXTERNALS, logLevel: 'warning',
  })
  const stat = fs.statSync(out)
  console.log(`✓ preload.ts → preload.cjs  (${(stat.size / 1024).toFixed(1)} KB)`)
}

function copyIcon(outDir) {
  const iconPath = resolveRoot('assets', 'icon.png')
  const buildDir = resolveRoot('build')
  const outIcon = path.join(buildDir, 'icon.png')
  if (fs.existsSync(iconPath)) {
    fs.mkdirSync(buildDir, { recursive: true })
    fs.copyFileSync(iconPath, outIcon)
    console.log('✓ icon.png → build/icon.png')
  } else if (fs.existsSync(outIcon)) {
    console.log('· icon.png 已在 build/icon.png，跳过复制')
  } else {
    console.warn('· 找不到 icon.png，请放在 assets/icon.png（可选）')
  }
}

// ================================================================
// V3 postProcessReleases()
//   1) 给 latest*.yml 的 files[].url 与顶层 path 显式加上 v<SEMVER>/ 前缀。
//      原因：electron-updater 的 generic provider feedURL = https://subsilicon.cn/releases
//      它会以 <feedURL>/<yml.url> 拼接真实下载地址 → 必须是
//      https://subsilicon.cn/releases/vX.Y.Z/<文件名> 才能命中 nginx alias。
//   2) 还原 %20 → 空格（URL encode 交给 electron-updater 或 web 端处理）
//   3) 校验 sha512/size 完全匹配（防打包/传输中途损坏）
//   4) 生成 releases-manifest.json 给网站端 download-config 读
//   5) 生成 CHECKSUMS_SHA256.txt
// ================================================================
function normalizeAndEnsureVersionPrefix(value, semver) {
  const prefix = `v${semver}/`
  const v1 = value.replace(/%20/g, ' ').trim()
  const hasQuote = v1.startsWith('"') || v1.startsWith("'")
  const quote = hasQuote ? v1[0] : ''
  const inner = hasQuote ? v1.slice(1, v1.length - 1) : v1
  let stripped = inner.replace(new RegExp(`^/?v?${semver.replace(/\\./g, '\\\\.')}/`), '')
  stripped = stripped.replace(/^\/+/, '')
  return quote ? quote + prefix + stripped + quote : prefix + stripped
}


function sha512File(filePath) {
  const h = crypto.createHash('sha512')
  h.update(fs.readFileSync(filePath))
  return h.digest('base64')
}
function sha256File(filePath) {
  const h = crypto.createHash('sha256')
  const fd = fs.openSync(filePath, 'r')
  const buf = Buffer.allocUnsafe(1024 * 1024)
  let n = 0
  while ((n = fs.readSync(fd, buf, 0, buf.length)) > 0) h.update(buf.subarray(0, n))
  fs.closeSync(fd)
  return h.digest('hex')
}

function fixYml(ymlPath, semver) {
  let text = fs.readFileSync(ymlPath, 'utf-8')
  // 两种缩进："  - url:" 和顶层 "path:"
  text = text.replace(/^(\s*-?\s*(?:url|path):\s*)(.+)$/gm, (_m, head, val) => {
    // val 两端引号可选
    const trimmed = val.trim()
    const hasQuote = trimmed.startsWith('"') || trimmed.startsWith("'")
    const quote = hasQuote ? trimmed[0] : ''
    const inner = hasQuote ? trimmed.slice(1, trimmed.length - 1) : trimmed
    const fixed = normalizeAndEnsureVersionPrefix(inner, semver)
    const restored = quote ? quote + fixed + quote : fixed
    return head + restored
  })
  fs.writeFileSync(ymlPath, text, 'utf-8')
  console.log(`${GREEN('[post:yml]')} ${path.basename(ymlPath)} 已加上 v<SEMVER>/ 版本前缀（对齐 feedURL=https://subsilicon.cn/releases） + 还原空格`)
  return text
}

function parseYmlFilesSection(text) {
  // 最简解析：files 段中每一行 `url:`, `sha512:`, `size:` 成一组
  // 返回 [{url,sha512,size}, ...] + 顶层 path/sha512/size
  const lines = text.split(/\r?\n/)
  const files = []
  let cur = null
  let top = {}
  let inFiles = false
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '')
    if (/^\s*files:\s*$/.test(line)) { inFiles = true; continue }
    if (inFiles && /^\s*-\s+url:\s*(.*)$/.test(line)) {
      if (cur) files.push(cur)
      cur = { url: RegExp.$1.trim().replace(/^['"]|['"]$/g, '') }
      continue
    }
    if (inFiles && cur) {
      let m
      if ((m = /^\s+sha512:\s*(.+)$/.exec(line))) { cur.sha512 = m[1].trim().replace(/^['"]|['"]$/g, '') ; continue }
      if ((m = /^\s+size:\s*(.+)$/.exec(line))) { cur.size = parseInt(m[1].trim(), 10) ; continue }
      // 行首非空白 或 下一项 "- url:" 出现之前已经在逻辑分支里处理
      if (/^\S/.test(line) && !/^\s*#/.test(line)) { inFiles = false; /* 继续顶层解析 */ }
    }
    if (!inFiles) {
      let m
      if ((m = /^path:\s*(.+)$/.exec(line)))        top.path   = m[1].trim().replace(/^['"]|['"]$/g, '')
      else if ((m = /^sha512:\s*(.+)$/.exec(line))) top.sha512 = m[1].trim().replace(/^['"]|['"]$/g, '')
      else if ((m = /^size:\s*(.+)$/.exec(line)))   top.size   = parseInt(m[1].trim(), 10)
    }
  }
  if (cur) files.push(cur)
  return { files, top }
}

function validateYml(ymlPath, releaseDir) {
  const text = fs.readFileSync(ymlPath, 'utf-8')
  const { files, top } = parseYmlFilesSection(text)
  const ymlName = path.basename(ymlPath)
  const all = files.slice()
  if (top.path) all.push({ url: top.path, sha512: top.sha512, size: top.size })
  let failures = 0
  for (const f of all) {
    if (!f || !f.url) continue
    // yml 里 url/path 已加 vX.Y.Z/ 前缀，但 releaseDir 根直接存放二进制文件
    const fp = path.join(releaseDir, path.basename(f.url))
    if (!fs.existsSync(fp)) {
      console.error(`${RED('[post:validate]')} [${ymlName}] 文件不存在：${fp}`)
      failures++; continue
    }
    const sz = fs.statSync(fp).size
    if (f.size != null && f.size !== sz) {
      console.error(`${RED('[post:validate]')} [${ymlName}] size 不匹配 ${f.url}  yml=${f.size}  disk=${sz}`)
      failures++
    }
    if (f.sha512) {
      const actual = sha512File(fp)
      if (actual !== f.sha512) {
        console.error(`${RED('[post:validate]')} [${ymlName}] sha512 不匹配 ${f.url}`)
        console.error(`  yml:   ${f.sha512}`)
        console.error(`  disk:  ${actual}`)
        failures++
      }
    }
  }
  if (failures === 0) console.log(`${GREEN('[post:validate]')} ${ymlName}  sha512/size 全部通过 (${all.length} 项)`)
  return failures
}

function deriveManifestArtifact(filename, buildInfo) {
  // 文件名规范：${productName}-${version}-${platform}-${arch}.${ext}
  // 如：SubSilicon Editor-1.16.0-macos-arm64.dmg
  const m = /-(windows|macos|linux)-(arm64|x64|ia32|armv7l|universal)\.(dmg|exe|AppImage|deb|rpm|tar\.gz|zip|msi|blockmap)$/i.exec(filename)
  if (!m) return null
  const plat = m[1].toLowerCase()
  const arch = m[2].toLowerCase()
  const ext  = m[3].toLowerCase()
  const pmap = { windows: 'windows', macos: 'macos', linux: 'linux' }
  const hintMap = {
    'macos+arm64': 'Apple Silicon (M1/M2/M3/M4)',
    'macos+x64':   'Intel Mac',
    'windows+x64': 'Windows 10/11 x64',
    'windows+ia32':'Windows 10/11 x86 (32-bit)',
    'linux+x64':   'Linux x64',
  }
  return {
    platform: pmap[plat] || plat,
    arch,
    filename,
    ext,
    hint: hintMap[`${plat}+${arch}`] || `${plat} ${arch}`,
  }
}

function postProcessReleases({ buildInfo }) {
  const releaseDir = resolveRoot('release')
  if (!fs.existsSync(releaseDir)) {
    console.log(`${YEL('[post]')} release/ 目录不存在，跳过 postProcess`)
    return
  }

  // 1) + 2) 处理三个 yml
  const ymls = ['latest-mac.yml', 'latest.yml', 'latest-linux.yml']
  for (const y of ymls) {
    const fp = path.join(releaseDir, y)
    if (!fs.existsSync(fp)) continue
    fixYml(fp, buildInfo.semver)
  }

  // 3) 校验 yml 里每个 url/path 都真实对应磁盘文件 + sha512/size 一致
  let fails = 0
  for (const y of ymls) {
    const fp = path.join(releaseDir, y)
    if (!fs.existsSync(fp)) continue
    fails += validateYml(fp, releaseDir)
  }
  if (fails > 0) {
    console.error(`${RED('[post]')} yml 校验失败 ${fails} 处，中止构建流程`)
    process.exit(1)
  }

  // 4) 生成 releases-manifest.json（主三大件：dmg / exe）
  const wantExt = new Set(['dmg', 'exe', 'AppImage', 'deb'])
  const entries = fs.readdirSync(releaseDir)
    .filter((n) => !n.endsWith('.blockmap') && !n.endsWith('.yml') && !n.endsWith('.txt') && !n.endsWith('.json'))
    .map((n) => {
      const fp = path.join(releaseDir, n)
      return fs.statSync(fp).isFile() ? { name: n, path: fp } : null
    })
    .filter(Boolean)
  const artifacts = []
  const checksumLines = []
  for (const e of entries) {
    const st = fs.statSync(e.path)
    const meta = deriveManifestArtifact(e.name, buildInfo)
    const sha256 = sha256File(e.path)
    checksumLines.push(`${sha256}  ${e.name}`)
    if (!meta) continue
    if (!wantExt.has(meta.ext)) continue
    artifacts.push({
      platform: meta.platform,
      arch: meta.arch,
      filename: meta.filename,
      size: st.size,
      sha256,
      ext: meta.ext,
      hint: meta.hint,
    })
  }
  // 按稳定顺序：macos arm64, macos x64, windows x64, linux x64
  const order = ['macos:arm64', 'macos:x64', 'windows:x64', 'linux:x64', 'linux:arm64', 'windows:ia32']
  artifacts.sort((a, b) => order.indexOf(`${a.platform}:${a.arch}`) - order.indexOf(`${b.platform}:${b.arch}`))

  const manifest = {
    version: buildInfo.semver,
    updatedAt: new Date().toISOString(),
    artifacts,
    githubReleasesUrl: 'https://github.com/junhan29/subsilicon-editor/releases/latest',
  }
  const manifestJson = JSON.stringify(manifest, null, 2) + '\n'
  const out1 = path.join(releaseDir, 'releases-manifest.json')
  fs.writeFileSync(out1, manifestJson, 'utf-8')
  console.log(`${GREEN('[post:manifest]')} ${out1}  已生成 (${artifacts.length} artifacts)`)

  // 同一份同步到网站项目 public/releases/v<SEMVER>/releases-manifest.json（若网站目录存在）
  const siteDir = '/Users/seey/projects/SubSilicon/public/releases'
  const siteVersionDir = path.resolve(siteDir, `v${buildInfo.semver}`)
  try {
    if (fs.existsSync('/Users/seey/projects/SubSilicon/public')) {
      fs.mkdirSync(siteVersionDir, { recursive: true })
      fs.writeFileSync(path.join(siteVersionDir, 'releases-manifest.json'), manifestJson, 'utf-8')
      console.log(`${GREEN('[post:manifest]')} 已同步 → ${path.join(siteVersionDir, 'releases-manifest.json')}`)
    }
  } catch (e) {
    console.warn(`${YEL('[post:manifest]')} 同步到网站失败（非致命）：`, e.message)
  }

  // 5) CHECKSUMS_SHA256.txt
  const checksumText =
    `# SubSilicon Editor v${buildInfo.semver}  SHA256 checksums\n` +
    `# Generated ${buildInfo.buildTime}\n` +
    checksumLines.join('\n') + '\n'
  const ck1 = path.join(releaseDir, 'CHECKSUMS_SHA256.txt')
  fs.writeFileSync(ck1, checksumText, 'utf-8')
  console.log(`${GREEN('[post:checksums]')} ${ck1}  (${checksumLines.length} 项)`)
}

async function main() {
  const startTime = Date.now()
  const pre = preflightPatch()

  // 支持两个运行模式：
  //   node desktop/build.cjs              → 仅 TS→CJS 编译（原有行为，供 electron:dev 用）
  //   node desktop/build.cjs dist [flags] → 额外调用 electron-builder（三平台/当前平台）
  const args = process.argv.slice(2)
  const mode = args[0] || 'compile'

  console.log('🚀 SubSilicon Editor Desktop Build (TS → CJS)\n')
  console.log('  源文件：  desktop/main.ts, desktop/preload.ts')
  console.log('  输出目录：desktop/')
  console.log('  模式：   ', mode)
  console.log('')

  const outDir = resolveDesktop('.')
  fs.mkdirSync(outDir, { recursive: true })
  try {
    await compileMain(outDir)
    await compilePreload(outDir)
  } catch (e) {
    console.error('\n❌ ESBuild 编译失败：', e.message || e)
    process.exit(1)
  }
  copyIcon(outDir)

  const elapsed = Date.now() - startTime
  console.log(`\n✅ 桌面端 TS→CJS 编译完成 (${elapsed}ms)`)

  if (mode === 'dist') {
    console.log('\n🔨 启动 electron-builder 打包...')
    try {
      // 透传后续 flags：--mac / --win / --linux 等；默认不加 flag 让 build 读 package.json 的默认目标（取决于当前 OS）
      const flags = args.slice(1)
      const builderCli = (() => {
        const cands = [
          resolveRoot('node_modules', 'electron-builder', 'out', 'cli', 'cli.js'),
          resolveRoot('node_modules', '.bin', 'electron-builder'),
        ]
        for (const c of cands) if (fs.existsSync(c)) return c
        return null
      })()
      if (!builderCli) {
        console.error(RED('❌ 未找到 electron-builder CLI（请 npm install）'))
        process.exit(1)
      }
      // publish never：我们自己同步到网站，不走 generic provider 上传
      const cmd = [builderCli, ...flags, '--publish', 'never']
      console.log(`   $ node ${cmd.join(' ')}`)
      execSync(`node ${cmd.map((c) => JSON.stringify(c)).join(' ')}`, {
        cwd: resolveRoot('.'), stdio: 'inherit',
        env: Object.assign({}, process.env, {
          // electron-builder 会多次 require package.json；我们已在 preflight 对齐
        }),
      })
    } catch (e) {
      console.error(RED(`❌ electron-builder 打包失败：${e && e.message ? e.message : e}`))
      process.exit(1)
    }
    postProcessReleases({ buildInfo: pre.buildInfo })
    console.log(GREEN('\n🎉 完整打包 & 后处理结束'))
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(RED('❌ 未捕获异常：'), e)
    process.exit(1)
  })
}

module.exports = { main, compileMain, compilePreload, preflightPatch, postProcessReleases }

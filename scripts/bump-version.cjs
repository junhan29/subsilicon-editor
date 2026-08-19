#!/usr/bin/env node
/**
 * 单源版本号 bump 脚本。
 *   用法：
 *     node scripts/bump-version.cjs                 # 打印当前版本
 *     node scripts/bump-version.cjs patch           # patch+1，并 patch package.json.version
 *     node scripts/bump-version.cjs minor           # minor+1, patch=0
 *     node scripts/bump-version.cjs major           # major+1, minor=0, patch=0
 *     node scripts/bump-version.cjs <type> --commit # 顺便 git commit -m "chore: bump vX.Y.Z"
 *
 *  不依赖 semver 包（手写 inc），可在安装 node_modules 前裸跑。
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const BUILD_VERSION_CJS = path.join(ROOT, 'desktop', 'build-version.cjs')
const PKG_JSON = path.join(ROOT, 'package.json')

function incSemver(ver, type) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([\w.]+))?$/.exec(ver.trim())
  if (!m) throw new Error(`SEMVER 格式非法: ${ver}`)
  let [major, minor, patch] = [m[1], m[2], m[3]].map(Number)
  if (type === 'major') { major += 1; minor = 0; patch = 0 }
  else if (type === 'minor') { minor += 1; patch = 0 }
  else if (type === 'patch') { patch += 1 }
  else throw new Error(`未知 bump type: ${type}，仅支持 patch|minor|major`)
  return `${major}.${minor}.${patch}`
}

// —— 从 desktop/build-version.cjs 中用正则提取当前 SEMVER 行（非 require，因为写回要保留结构）
function readCurrentSemver() {
  const src = fs.readFileSync(BUILD_VERSION_CJS, 'utf-8')
  const m = /^\s*const\s+SEMVER\s*=\s*['"]([^'"]+)['"]\s*$/m.exec(src)
  if (!m) throw new Error(`在 ${BUILD_VERSION_CJS} 中找不到 const SEMVER = 'x.y.z' 行`)
  return m[1]
}

function writeBuildVersion(newSemver) {
  let src = fs.readFileSync(BUILD_VERSION_CJS, 'utf-8')
  const next = src.replace(
    /^(\s*const\s+SEMVER\s*=\s*['"])([^'"]+)(['"]\s*)$/m,
    (_, pre, _old, post) => `${pre}${newSemver}${post}`
  )
  if (next === src) throw new Error(`SEMVER 行替换失败`)
  fs.writeFileSync(BUILD_VERSION_CJS, next, 'utf-8')
}

function syncPackageJson(newSemver) {
  const pkg = JSON.parse(fs.readFileSync(PKG_JSON, 'utf-8'))
  pkg.version = newSemver
  fs.writeFileSync(PKG_JSON, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
}

function main() {
  const args = process.argv.slice(2)
  const bumpType = (args.find((a) => !a.startsWith('--')) || '').toLowerCase()
  const doCommit = args.includes('--commit')

  const cur = readCurrentSemver()

  if (!bumpType) {
    // 无参：仅打印
    const v = require(BUILD_VERSION_CJS)
    console.log(`SEMVER     : ${v.SEMVER}`)
    console.log(`PRERELEASE : ${v.PRERELEASE || '(stable)'}`)
    console.log(`BUILD_NUM  : ${v.BUILD_NUMBER}`)
    console.log(`COMMIT     : ${v.COMMIT}`)
    console.log(`BUILD_TIME : ${v.BUILD_TIME}`)
    console.log(`CHANNEL    : ${v.CHANNEL}`)
    console.log(`VERSION    : ${v.VERSION}`)
    // 顺带检查 package.json 漂移
    const pkg = JSON.parse(fs.readFileSync(PKG_JSON, 'utf-8'))
    if (pkg.version !== v.SEMVER) {
      console.warn(`\n⚠️  漂移警告：package.json.version=${pkg.version}  !=  build-version.SEMVER=${v.SEMVER}`)
      console.warn(`   → 请执行：node scripts/bump-version.cjs patch  或手工对齐`)
    } else {
      console.log(`\n✅ package.json 与 build-version 一致`)
    }
    process.exit(0)
  }

  const next = incSemver(cur, bumpType)
  console.log(`Bump ${bumpType}:  ${cur}  →  ${next}`)
  writeBuildVersion(next)
  syncPackageJson(next)
  console.log(`✅ desktop/build-version.cjs SEMVER 已更新为 ${next}`)
  console.log(`✅ package.json version 已同步为 ${next}`)

  if (doCommit) {
    const msg = `chore: bump version to v${next}`
    try {
      execSync(`git add desktop/build-version.cjs package.json && git commit -m ${JSON.stringify(msg)}`, {
        cwd: ROOT, stdio: 'inherit',
      })
      console.log(`✅ git commit: ${msg}`)
    } catch (e) {
      console.error(`❌ git commit 失败: ${e && e.message ? e.message : e}`)
      process.exit(1)
    }
  }
}

try { main() } catch (e) {
  console.error(`❌ ${e.message || e}`)
  process.exit(1)
}

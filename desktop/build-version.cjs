// 单源版本号：编辑器版本真值。任何其它地方 (package.json / build-info.json /
// runtime / autoUpdater) 都以此文件为准，构建前会强制 patch。
// 改动版本只需改这里一行 + 执行 `node scripts/bump-version.cjs patch|minor|major`。
'use strict'

const SEMVER = '1.18.3'
// 可选后缀（beta / rc / nightly），留空字符串表示稳定版
const PRERELEASE = ''
// 构建信息：CI 或本地构建时覆盖 BUILD_NUMBER / GIT_COMMIT env
const BUILD_NUMBER = process.env.BUILD_NUMBER || 'local'
const COMMIT = (process.env.GIT_COMMIT || '').slice(0, 8) || 'dev'
const BUILD_TIME = new Date().toISOString()
const VERSION = PRERELEASE ? `${SEMVER}-${PRERELEASE}.${BUILD_NUMBER}` : SEMVER
const CHANNEL = PRERELEASE || 'stable'

module.exports = { SEMVER, PRERELEASE, BUILD_NUMBER, COMMIT, BUILD_TIME, VERSION, CHANNEL }

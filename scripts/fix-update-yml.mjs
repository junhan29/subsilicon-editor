/**
 * 修复 electron-updater 的 latest-mac.yml / latest.yml
 * 1. electron-builder 默认生成的 url 是纯文件名（相对路径），
 *    但服务器按版本分子目录存储（releases/v{version}/文件名），
 *    需要给 url 加上 v{version}/ 前缀。
 * 2. URL 中的空格必须编码为 %20，否则 electron-updater 的 https 请求会失败。
 *
 * 在 npm run electron:build 后自动运行。
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const releaseDir = join(__dirname, '..', 'release')

// 从 package.json 读取版本号
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'))
const version = pkg.version
const prefix = `v${version}/`

const ymlFiles = ['latest-mac.yml', 'latest.yml', 'latest-linux.yml']

for (const ymlFile of ymlFiles) {
  const ymlPath = join(releaseDir, ymlFile)
  if (!existsSync(ymlPath)) continue

  let content = readFileSync(ymlPath, 'utf-8')

  // 1. 给所有 "url: 文件名" 替换为 "url: v{version}/文件名"
  //    匹配 "url: xxx" 且 xxx 不以 v{version}/ 开头（幂等，不会重复添加）。
  //    注意负向前瞻必须包含 \s*，否则 \s* 回溯会绕过前瞻导致重复加前缀。
  content = content.replace(/^(\s*-?\s*url:\s*)(?!\s*v\d+\.\d+\.\d+\/)(.+)$/gm, `$1${prefix}$2`)
  // 同样处理 path: 字段
  content = content.replace(/^(path:\s*)(?!\s*v\d+\.\d+\.\d+\/)(.+)$/gm, `$1${prefix}$2`)

  // 2. URL 中的空格编码为 %20（幂等，%20 不会被重复编码）
  content = content.replace(/^(\s*-?\s*url:\s*v\d+\.\d+\.\d+\/)(.+)$/gm, (_, head, filename) => `${head}${filename.replace(/ /g, '%20')}`)
  content = content.replace(/^(path:\s*v\d+\.\d+\.\d+\/)(.+)$/gm, (_, head, filename) => `${head}${filename.replace(/ /g, '%20')}`)

  writeFileSync(ymlPath, content, 'utf-8')
  console.log(`[fix-update-yml] ${ymlFile} 已修复，url 前缀: ${prefix}`)
}

console.log(`[fix-update-yml] 完成，版本: ${version}`)

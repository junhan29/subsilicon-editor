/**
 * 摊位打包与摊位宣传页生成
 *
 * 摊位包目录结构：
 *   booth/
 *     booth.json         摊位元数据（资料/陈列/试阅/价目/收款）
 *     preview.html       摊位宣传页（横幅/简介/陈列/试阅入口/联系，可独立部署）
 *     works/<slug>.json  各陈列作品（WorkDocument，含营利配置）
 *
 * 摊位包可整体导出/迁移/复制摆摊，不绑定任何平台。
 */

import JSZip from 'jszip'
import type { Booth, BoothWorkEntry } from './types'
import type { WorkDocument, WorkTypeId } from '@editor/types/work'
import type { StoredWork } from '@editor/lib/local-db/work-store'
import { getDocumentFromWork, getGraphFromWork } from '@editor/lib/local-db/work-store'
import { getWorkType } from '@editor/lib/work-registry'

export const DDP_PROTOCOL_VERSION = '1.1'

export interface BoothPackageFile {
  path: string
  content: string
}

export interface BoothExportItem {
  work: StoredWork
  entry: BoothWorkEntry
  doc: WorkDocument
}

/** 作品类型展示名 */
const WORK_TYPE_NAMES: Record<string, string> = {
  'interactive-narrative': '互动叙事',
  novel: '小说',
  video: '视频',
  comic: '漫画',
}

/** 试阅片段文案 */
function previewLabel(entry: BoothWorkEntry): string {
  const v = Math.max(0, entry.preview.value)
  switch (entry.preview.type) {
    case 'chapters':
      return `试阅前 ${v} 章`
    case 'seconds':
      return `试看前 ${v} 秒`
    case 'nodes':
      return `试玩前 ${v} 个节点`
    case 'panels':
      return `试阅前 ${v} 格`
  }
}

/** 价目文案 */
function pricingLabel(entry: BoothWorkEntry): string {
  const p = entry.pricing
  if (!p.override) return '按作品定价'
  const parts: string[] = []
  if (p.whole && p.whole > 0) parts.push(`整本 ¥${p.whole}`)
  if (p.chapter && p.chapter > 0) parts.push(`章节 ¥${p.chapter}`)
  if (p.segment && p.segment > 0) parts.push(`片段 ¥${p.segment}`)
  return parts.length ? parts.join(' / ') : '免费'
}

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 构建摊位宣传页 HTML（独立部署，无外部依赖） */
export function generateBoothPreviewHTML(
  booth: Booth,
  items: BoothExportItem[],
  featuredId?: string | null
): string {
  const handle = booth.creator.handle || booth.name || '创作者摊位'
  const tags = booth.profile.tags
    .filter(Boolean)
    .map((t) => `<span class="tag">${esc(t)}</span>`)
    .join('')

  const workCards = items
    .map((item) => {
      const isFeatured = featuredId && item.work.id === featuredId
      const doc = item.doc
      const cover = doc.meta?.coverImage || item.work.thumbnail || ''
      const coverHtml = cover
        ? `<div class="cover" style="background-image:url('${esc(cover)}')"></div>`
        : `<div class="cover cover-empty"></div>`
      return `
        <div class="work${isFeatured ? ' featured' : ''}">
          ${coverHtml}
          <div class="work-body">
            <div class="work-title">${esc(doc.meta?.title || item.work.name)}</div>
            <div class="work-meta">${WORK_TYPE_NAMES[item.work.workType || ''] || esc(item.work.workType || '')} · ${previewLabel(item.entry)} · ${pricingLabel(item.entry)}</div>
            ${doc.meta?.description ? `<div class="work-desc">${esc(doc.meta.description)}</div>` : ''}
          </div>
        </div>`
    })
    .join('')

  const manualChannels = booth.channels.manual
    .filter((c) => c.value.trim())
    .map((c) => `<div class="channel"><span class="channel-kind">${esc(c.label || c.kind)}</span><span class="channel-value">${esc(c.value)}</span></div>`)
    .join('')
  const thirdPartyChannels = booth.channels.thirdParty
    .filter((c) => c.link.trim())
    .map((c) => `<a class="channel channel-link" href="${esc(c.link)}" target="_blank" rel="noopener noreferrer"><span class="channel-kind">${esc(c.label || c.kind)}</span><span class="channel-value">前往 →</span></a>`)
    .join('')
  const channelsHtml = manualChannels || thirdPartyChannels
    ? `<section class="block"><h2>收款方式</h2><div class="channels">${manualChannels}${thirdPartyChannels}</div></section>`
    : ''

  const contactHtml = booth.creator.contact.trim()
    ? `<section class="block"><h2>联系创作者</h2><p class="contact">${esc(booth.creator.contact)}</p></section>`
    : ''

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(handle)} · 摊位</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif; background: #f7f3ec; color: #2c241c; line-height: 1.7; }
  .page { max-width: 920px; margin: 0 auto; padding: 24px 16px 48px; }
  .hero { border-radius: 20px; padding: 40px 28px; position: relative; overflow: hidden; background: linear-gradient(135deg, #e8b04b22, transparent 45%, #3f7fc922); border: 1px solid #e5dccd; }
  .badge { display: inline-block; font-size: 12px; padding: 3px 10px; border-radius: 999px; background: #c97b2d; color: #fff; margin-bottom: 14px; }
  .handle { font-size: 32px; font-weight: 800; }
  .slogan { margin-top: 6px; color: #6b5f51; }
  .tags { margin-top: 12px; }
  .tag { display: inline-block; font-size: 12px; padding: 2px 10px; border-radius: 999px; background: #fff; border: 1px solid #dcd2c2; color: #6b5f51; margin-right: 6px; }
  .bio { margin-top: 16px; color: #5a5044; font-size: 15px; max-width: 640px; }
  .block { margin-top: 28px; }
  h2 { font-size: 18px; margin-bottom: 12px; color: #2c241c; }
  .works { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
  .work { background: #fffdf9; border: 1px solid #e5dccd; border-radius: 14px; overflow: hidden; }
  .work.featured { box-shadow: 0 0 0 2px #c97b2d; }
  .cover { height: 130px; background-size: cover; background-position: center; }
  .cover-empty { background: linear-gradient(135deg, #e8b04b33, #c97b2d22); }
  .work-body { padding: 12px 14px; }
  .work-title { font-weight: 700; }
  .work-meta { font-size: 12px; color: #8a7a67; margin-top: 4px; }
  .work-desc { font-size: 13px; color: #6b5f51; margin-top: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .channels { display: flex; flex-wrap: wrap; gap: 10px; }
  .channel { background: #fffdf9; border: 1px solid #e5dccd; border-radius: 10px; padding: 8px 14px; font-size: 13px; display: inline-flex; align-items: center; gap: 10px; text-decoration: none; color: inherit; }
  .channel-kind { color: #8a7a67; }
  .channel-value { font-weight: 600; }
  a.channel-link:hover { border-color: #c97b2d; }
  .contact { background: #fffdf9; border: 1px solid #e5dccd; border-radius: 10px; padding: 12px 16px; font-size: 14px; }
  .compliance { margin-top: 32px; font-size: 12px; color: #9a8c7a; text-align: center; }
  .empty { text-align: center; color: #9a8c7a; padding: 40px 0; border: 1px dashed #dcd2c2; border-radius: 14px; }
</style>
</head>
<body>
<div class="page">
  <section class="hero">
    <span class="badge">创作者摊位</span>
    <div class="handle">${esc(handle)}</div>
    ${booth.profile.slogan.trim() ? `<div class="slogan">${esc(booth.profile.slogan)}</div>` : ''}
    ${tags ? `<div class="tags">${tags}</div>` : ''}
    ${booth.creator.bio.trim() ? `<p class="bio">${esc(booth.creator.bio)}</p>` : ''}
  </section>

  <section class="block">
    <h2>陈列作品</h2>
    ${workCards || '<div class="empty">摊位上还没有陈列作品</div>'}
  </section>

  ${channelsHtml}
  ${contactHtml}

  <p class="compliance">${esc(booth.complianceNote || '本站仅发布作品宣传信息，不提供在线浏览/试读/试玩；交易请直接联系创作者。')}</p>
</div>
</body>
</html>`
}

/**
 * 构建 DDP 1.1 摊位元数据（协议升级核心）
 *
 * 结构（向后兼容：旧墙可忽略新增字段）：
 *   protocolVersion / booth(handle/bio/slogan/tags) / works[{workId, workType, preview, stats}]
 * stats 由对应 WorkTypeAdapter.getDdpStats 生成（类型化统计）。
 */
export function buildBoothDdp(
  booth: Booth,
  items: BoothExportItem[]
): {
  protocolVersion: string
  booth: { handle: string; bio: string; slogan: string; tags: string[] }
  works: Array<{
    workId: string
    workType: string
    title: string
    preview: BoothWorkEntry['preview']
    stats: Record<string, unknown>
  }>
} {
  return {
    protocolVersion: DDP_PROTOCOL_VERSION,
    booth: {
      handle: booth.creator.handle || booth.name || '创作者摊位',
      bio: booth.creator.bio,
      slogan: booth.profile.slogan,
      tags: booth.profile.tags,
    },
    works: items.map((item) => {
      let stats: Record<string, unknown> = {}
      try {
        stats = getWorkType(item.work.workType).getDdpStats(getGraphFromWork(item.work)) || {}
      } catch {
        stats = {}
      }
      return {
        workId: item.work.id,
        workType: item.work.workType || 'interactive-narrative',
        title: item.doc.meta?.title || item.work.name,
        preview: item.entry.preview,
        stats,
      }
    }),
  }
}

/** 构建摊位包文件清单 */
export function buildBoothPackage(booth: Booth, items: BoothExportItem[]): BoothPackageFile[] {
  const files: BoothPackageFile[] = []
  files.push({ path: 'booth/booth.json', content: JSON.stringify(booth, null, 2) })
  files.push({
    path: 'booth/ddp.json',
    content: JSON.stringify(buildBoothDdp(booth, items), null, 2),
  })
  files.push({
    path: 'booth/preview.html',
    content: generateBoothPreviewHTML(booth, items, booth.display.featuredId),
  })
  for (const item of items) {
    const slug = (item.doc.meta?.title || item.work.name || item.work.id)
      .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
      .slice(0, 60) || `work-${item.work.id}`
    files.push({
      path: `booth/works/${item.work.id}_${slug}.json`,
      content: JSON.stringify(item.doc, null, 2),
    })
  }
  return files
}

/** 导出摊位为 zip Blob */
export async function buildBoothZip(booth: Booth, items: BoothExportItem[]): Promise<Blob> {
  const zip = new JSZip()
  for (const file of buildBoothPackage(booth, items)) {
    zip.file(file.path, file.content)
  }
  return zip.generateAsync({ type: 'blob' })
}

/** 摊位名 → 文件名 */
export function boothFileName(name: string): string {
  const safe = name.replace(/[^\w\u4e00-\u9fa5-]+/g, '-').slice(0, 40)
  return `${safe || 'booth'}-booth`
}

/** 保存摊位 zip（Electron 保存对话框；浏览器环境降级为下载） */
export async function saveBoothZip(booth: Booth, items: BoothExportItem[]): Promise<{ success: boolean; error?: string }> {
  const blob = await buildBoothZip(booth, items)
  const api = window.__electronAPI
  if (api?.saveFileDialog && api?.writeFile) {
    const result = await api.saveFileDialog({
      title: '导出摊位包',
      defaultPath: `${boothFileName(booth.name)}.zip`,
      filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }],
    })
    if (!result.success || !result.path) {
      return { success: false, error: result.error || '已取消' }
    }
    const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()))
    const write = await api.writeFile(result.path, bytes)
    return write.success ? { success: true } : { success: false, error: write.error }
  }
  // 浏览器降级：直接下载
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${boothFileName(booth.name)}.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { success: true }
}

/** 汇总陈列作品为导出条目（按摊位陈列顺序） */
export function collectBoothItems(booth: Booth, works: StoredWork[]): BoothExportItem[] {
  const byId = new Map(works.map((w) => [w.id, w]))
  const order = booth.display.order.filter((id) => byId.has(id))
  // 未在 order 中的已入摊作品追加在末尾（数据兜底）
  const extra = booth.works.filter((e) => byId.has(e.workId) && !order.includes(e.workId)).map((e) => e.workId)
  const orderedIds = [...order, ...extra]
  return orderedIds
    .map((id) => {
      const work = byId.get(id)
      const entry = booth.works.find((e) => e.workId === id)
      if (!work || !entry) return null
      return { work, entry, doc: getDocumentFromWork(work) }
    })
    .filter((x): x is BoothExportItem => x !== null)
}

/**
 * 小说导出器（EPUB / HTML / TXT / 预览 HTML）
 *
 * 基于小说数据（NovelData）生成可分发产物：
 * - EPUB：标准电子书（章节、封面、目录）
 * - HTML：单文件在线阅读页面（支持付费章节展示「试读」提示）
 * - TXT：纯文本全文（不含付费章节内容）
 * - 预览 HTML：发布到作品墙的静态图文预览
 */

import JSZip from 'jszip'
import type { NovelChapter, NovelData } from '@editor/lib/work-types/novel'
import { countNovelWords } from '@editor/lib/work-types/novel'

function escapeXML(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function escapeHTML(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  const ts = Date.now().toString(16)
  const rnd = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  return `${ts.slice(0, 8)}-${rnd.slice(0, 4)}-4${rnd.slice(4, 7)}-a${rnd.slice(7, 10)}-${rnd.slice(10, 22)}`
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名小说'
}

/** 判断章节是否付费且需要试读遮蔽（展示用） */
function isLockedChapter(chapter: NovelChapter, data: NovelData): boolean {
  const idx = data.chapters.findIndex((c) => c.id === chapter.id)
  // 整本付费：试读 N 章之后的所有章节一律锁定（不论单章 paid 标记），
  // 与「整本买断」语义一致；未设置整本价时按章节付费判定。
  if ((data.wholePrice ?? 0) > 0) {
    return idx >= data.freePreviewChapters
  }
  if (!chapter.paid) return false
  return idx >= data.freePreviewChapters
}

/** 计算章节解锁提示价格：整本付费显示整本价，章节付费显示章节价 */
function getLockPrice(chapter: NovelChapter, data: NovelData): number {
  if ((data.wholePrice ?? 0) > 0) return data.wholePrice ?? 0
  return chapter.price || 0
}

// ============ EPUB ============

function buildEpubChapterXHTML(title: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <head><title>${escapeXML(title)}</title><link rel="stylesheet" type="text/css" href="style.css" /></head>
  <body><h2>${escapeXML(title)}</h2>${body}</body>
</html>`
}

function buildEpubStyleCSS(): string {
  return `body { font-family: 'PingFang SC', 'Noto Serif SC', serif; line-height: 1.9; color: #1f2937; }
h2 { color: #b45309; border-bottom: 2px solid #d4a574; padding-bottom: 0.3em; }
p { margin: 0.6em 0; text-indent: 2em; }
.epub-free-preview { color: #9ca3af; font-style: italic; border: 1px dashed #d1d5db; padding: 0.6em; text-align: center; }
.locked { color: #d97706; border: 1px dashed #d1d5db; padding: 1.5em; text-align: center; font-style: italic; }
.locked .sub { color: #9ca3af; font-size: 0.9em; }
`
}

function buildEpubContainerXML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" /></rootfiles>
</container>`
}

function buildEpubNCX(title: string, chapters: { id: string; title: string }[]): string {
  const navPoints = chapters
    .map((ch, i) => `    <navPoint id="${ch.id}" playOrder="${i + 2}"><navLabel><text>${escapeXML(ch.title)}</text></navLabel><content src="${ch.id}.xhtml" /></navPoint>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtc:generator" content="SubSilicon Editor" /></head>
  <docTitle><text>${escapeXML(title)}</text></docTitle>
  <navMap>
    <navPoint id="cover" playOrder="1"><navLabel><text>封面</text></navLabel><content src="cover.xhtml" /></navPoint>
${navPoints}
  </navMap>
</ncx>`
}

function buildEpubOPF(params: {
  title: string
  author: string
  description: string
  uuid: string
  chapterIds: string[]
}): string {
  const { title, author, description, uuid, chapterIds } = params
  const today = new Date().toISOString().split('T')[0]
  const chapterManifest = chapterIds
    .map((id) => `    <item id="${id}" href="${id}.xhtml" media-type="application/xhtml+xml" />`)
    .join('\n')
  const spineItems = ['cover', ...chapterIds].map((id) => `    <itemref idref="${id}" />`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXML(title)}</dc:title>
    <dc:creator>${escapeXML(author)}</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:identifier id="bookid">urn:uuid:${uuid}</dc:identifier>
    <dc:date>${today}</dc:date>
    ${description ? `<dc:description>${escapeXML(description)}</dc:description>` : ''}
  </metadata>
  <manifest>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml" />
    <item id="style" href="style.css" media-type="text/css" />
${chapterManifest}
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`
}

/** 导出 EPUB 电子书 */
export async function exportNovelToEPUB(
  data: NovelData,
  title: string,
  author = 'SubSilicon 创作者'
): Promise<Blob> {
  const sorted = [...data.chapters].sort((a, b) => a.order - b.order)
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('META-INF/container.xml', buildEpubContainerXML())

  const oebps = zip.folder('OEBPS')!
  oebps.file('style.css', buildEpubStyleCSS())
  const uuid = generateUUID()
  const chapterEntries = sorted.map((ch) => {
    // EPUB 与 TXT/HTML 保持一致：付费章节只输出占位提示，不打入正文
    const locked = isLockedChapter(ch, data)
    const lockPrice = getLockPrice(ch, data)
    const body = locked
      ? `<div class="locked"><p>本章节为付费内容</p><p class="sub">解锁 ¥${lockPrice} · 支持创作者，解锁完整章节</p></div>`
      : ch.contentHtml || ''
    return {
      id: ch.id,
      title: ch.title || '未命名章节',
      xhtml: buildEpubChapterXHTML(ch.title || '未命名章节', body),
    }
  })
  oebps.file('cover.xhtml', buildEpubChapterXHTML(title, `<p>${escapeXML(title)}</p><p>${escapeXML(author)}</p>`))
  oebps.file('toc.ncx', buildEpubNCX(title, chapterEntries))
  oebps.file('content.opf', buildEpubOPF({
    title,
    author,
    description: data.descriptionHtml ? escapeXML(data.descriptionHtml.replace(/<[^>]*>/g, '')) : '',
    uuid,
    chapterIds: chapterEntries.map((c) => c.id),
  }))
  for (const ch of chapterEntries) {
    oebps.file(`${ch.id}.xhtml`, ch.xhtml)
  }

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

// ============ TXT ============

/** 导出纯文本（付费章节内容以占位提示代替） */
export function exportNovelToTXT(data: NovelData, title: string): string {
  const sorted = [...data.chapters].sort((a, b) => a.order - b.order)
  const lines: string[] = [`《${title}》`, '']
  for (const ch of sorted) {
    lines.push(ch.title || '未命名章节')
    lines.push('')
    if (isLockedChapter(ch, data)) {
      const lockPrice = getLockPrice(ch, data)
      lines.push(`【本章节为付费内容，解锁 ¥${lockPrice}】`)
    } else {
      const text = ch.contentHtml
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
      lines.push(text)
    }
    lines.push('')
    lines.push('---')
    lines.push('')
  }
  return lines.join('\n')
}

// ============ HTML ============

/** 生成单文件在线阅读 HTML（付费章节显示试读遮罩） */
export function exportNovelToHTML(data: NovelData, title: string, author?: string): string {
  const sorted = [...data.chapters].sort((a, b) => a.order - b.order)
  const chaptersHtml = sorted
    .map((ch, i) => {
      const locked = isLockedChapter(ch, data)
      const lockPrice = getLockPrice(ch, data)
      const body = locked
        ? `<div class="locked"><p>本章节为付费内容</p><p class="sub">解锁 ¥${lockPrice} · 支持创作者，解锁完整章节</p></div>`
        : `<div class="chapter-body">${ch.contentHtml || '<p></p>'}</div>`
      return `<section class="chapter" data-chapter="${escapeHTML(ch.id)}">
  <h2>${escapeHTML(ch.title || `第 ${i + 1} 章`)}</h2>
  ${body}
</section>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHTML(title)}</title>
<style>
  body { font-family: 'PingFang SC', 'Noto Serif SC', 'Microsoft YaHei', serif; background: #faf9f7; color: #1f2937; line-height: 1.9; margin: 0; padding: 0; }
  .container { max-width: 720px; margin: 0 auto; padding: 40px 20px 80px; }
  h1 { text-align: center; color: #b45309; font-size: 28px; margin-bottom: 8px; }
  .author { text-align: center; color: #9ca3af; font-size: 14px; margin-bottom: 40px; }
  .description { background: #fff8f0; border: 1px solid #f0e0c8; border-radius: 8px; padding: 16px 20px; margin-bottom: 32px; font-size: 15px; }
  .chapter { background: #fff; border: 1px solid #eee6da; border-radius: 10px; padding: 28px 32px; margin-bottom: 24px; }
  .chapter h2 { color: #92400e; border-bottom: 2px solid #e8d8c0; padding-bottom: 8px; margin-top: 0; }
  .chapter-body p { text-indent: 2em; margin: 0.6em 0; }
  .locked { text-align: center; padding: 40px 0; color: #d97706; }
  .locked .sub { color: #9ca3af; font-size: 14px; margin-top: 8px; }
  .toc { position: sticky; top: 0; background: #faf9f7; padding: 12px 0; z-index: 10; }
  .toc a { color: #92400e; text-decoration: none; margin-right: 12px; font-size: 13px; }
  footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 40px; }
</style>
</head>
<body>
<div class="container">
  <h1>${escapeHTML(title)}</h1>
  ${author ? `<p class="author">${escapeHTML(author)}</p>` : ''}
  ${data.descriptionHtml ? `<div class="description">${data.descriptionHtml}</div>` : ''}
  <div class="toc">${sorted.map((ch, i) => `<a href="#${escapeHTML(ch.id)}">${escapeHTML(ch.title || `第 ${i + 1} 章`)}</a>`).join('')}</div>
${chaptersHtml}
  <footer>由 SubSilicon Editor 生成 · 去中心化创作工具</footer>
</div>
</body>
</html>`
}

/** 生成发布到作品墙的静态预览 HTML（前 N 个免费章节 + 简介） */
export function exportNovelPreviewHTML(data: NovelData, title: string, author?: string): string {
  const sorted = [...data.chapters].sort((a, b) => a.order - b.order)
  // 预览只取免费章节：付费章节正文此前被明文输出到作品墙预览，与
  // EPUB/HTML 导出的付费占位策略不一致，读者无需解锁即可读到付费内容。
  // 免费判定与导出一致（整本付费时试读 N 章之后的章节同样视为锁定）
  const freeChapters = sorted.filter((ch) => !isLockedChapter(ch, data))
  const previewCount = Math.min(3, freeChapters.length)
  const previewChapters = freeChapters.slice(0, previewCount)
  const wordCount = countNovelWords(data)

  const chaptersHtml = previewChapters
    .map((ch, i) => `<section class="chapter"><h3>${escapeHTML(ch.title || `第 ${i + 1} 章`)}</h3><div>${ch.contentHtml || '<p></p>'}</div></section>`)
    .join('\n')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHTML(title)} - 预览</title>
<style>
  body { font-family: 'PingFang SC', 'Noto Serif SC', serif; background: #faf9f7; color: #1f2937; line-height: 1.8; margin: 0; padding: 24px; }
  .card { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 10px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
  h1 { color: #b45309; font-size: 24px; margin: 0 0 4px; }
  .meta { color: #9ca3af; font-size: 13px; margin-bottom: 16px; }
  .chapter { border-top: 1px solid #f0e8dc; padding: 12px 0; }
  .chapter h3 { color: #92400e; margin: 0 0 8px; font-size: 16px; }
  .chapter p { margin: 0.5em 0; }
  .more { text-align: center; color: #d97706; margin-top: 12px; font-size: 14px; }
</style>
</head>
<body>
<div class="card">
  <h1>${escapeHTML(title)}</h1>
  <p class="meta">${author ? escapeHTML(author) + ' · ' : ''}共 ${sorted.length} 章 · 约 ${wordCount} 字</p>
  ${data.descriptionHtml ? `<div>${data.descriptionHtml}</div>` : ''}
${chaptersHtml}
  ${sorted.length > previewCount ? '<p class="more">…… 更多章节请联系创作者</p>' : ''}
</div>
</body>
</html>`
}

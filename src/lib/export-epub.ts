import JSZip from 'jszip'
import type { StoryGraph, StoryNode, StoryCharacter, ComicScene } from '@editor/types/editor'
import { topologicalSortNodes } from './export-script'

// EPUB 导出实现
//
// EPUB 本质是 ZIP，结构如下：
//   mimetype                       (不压缩，STORE 模式，必须是第一个文件)
//   META-INF/container.xml         (容器描述)
//   OEBPS/content.opf              (清单 + 元数据 + spine)
//   OEBPS/toc.ncx                  (NCX 导航)
//   OEBPS/cover.xhtml              (封面页，可选)
//   OEBPS/chapter-N.xhtml          (内容章节)
//   OEBPS/cover-image.(jpg|png)   (封面图，可选)
//
// 章节切分策略：按场景切换或结局节点切分；首节点构成第一章。

interface Chapter {
  id: string
  title: string
  xhtml: string
}

// 从 data URL 中解析出二进制和 MIME 类型
function dataURLToBinary(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  if (!dataUrl.startsWith('data:')) return null
  const [header, content] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream'
  const binary = atob(content)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return { bytes, mime }
}

// 转义 XHTML 文本内容
function escapeXHTML(text: unknown): string {
  if (text == null) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// 将换行转为 <br/>
function textToXHTML(text: string): string {
  return escapeXHTML(text)
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => `<p>${line}</p>`)
    .join('\n      ')
}

// 解析节点对应的场景
function resolveScene(node: StoryNode, scenes: ComicScene[] | undefined): ComicScene | null {
  const data = node.data as Record<string, unknown>
  const sceneId = data.sceneId as string | undefined
  if (sceneId && scenes) {
    const found = scenes.find((s) => s.id === sceneId)
    if (found) return found
  }
  const bg = data.backgroundImage as string | undefined
  if (bg && scenes) {
    const found = scenes.find((s) => s.backgroundImage === bg)
    if (found) return found
  }
  return null
}

// 查找角色名
function findCharacterName(characterId: string | undefined, characters: StoryCharacter[]): string {
  if (!characterId) return '???'
  return characters.find((c) => c.id === characterId)?.name || '???'
}

// 将单个节点渲染为 XHTML 片段
function nodeToXHTML(node: StoryNode, ctx: { characters: StoryCharacter[]; scenes?: ComicScene[] }): string {
  const data = node.data as Record<string, unknown>
  switch (node.type) {
    case 'dialogue': {
      const name = escapeXHTML(findCharacterName(data.characterId as string, ctx.characters))
      const text = escapeXHTML(data.text)
      const scene = resolveScene(node, ctx.scenes)
      let html = ''
      if (scene) {
        html += `<p class="scene">[场景：${escapeXHTML(scene.name)}${scene.style ? ' - ' + escapeXHTML(scene.style) : ''}]</p>\n      `
      }
      html += `<p class="dialogue"><span class="character">${name}</span>: ${text}</p>`
      return html
    }
    case 'narration': {
      const text = escapeXHTML(data.text)
      return `<p class="narration"><em>${text}</em></p>`
    }
    case 'choice': {
      const prompt = escapeXHTML(data.prompt) || '你的选择是？'
      const options = (data.options as Array<{ text?: string }>) || []
      const opts = options
        .map(
          (opt, i) =>
            `<li class="choice">→ 选项${String.fromCharCode(65 + i)}: ${escapeXHTML(opt.text || `选项 ${i + 1}`)}</li>`
        )
        .join('\n        ')
      return `<p class="choice-prompt">◆ ${prompt}</p>\n      <ul class="choices">\n        ${opts}\n      </ul>`
    }
    case 'ending': {
      const title = escapeXHTML(data.title) || '结局'
      const text = escapeXHTML(data.text)
      const type = escapeXHTML(data.endingType) || 'neutral'
      return `<div class="ending">\n        <h3>【结局：${title}】</h3>\n        <p class="ending-type">${type}</p>\n        ${text ? `<p>${text}</p>` : ''}\n      </div>`
    }
    case 'cg': {
      const title = escapeXHTML(data.title || data.subtitle) || 'CG 过场'
      const url = data.url as string | undefined
      const mediaType = data.mediaType as string | undefined
      let html = `<div class="cg">\n        <h3>[CG: ${title}]</h3>`
      if (url && url.startsWith('data:')) {
        if (mediaType === 'video') {
          html += `\n        <p class="media-placeholder">[视频资源]</p>`
        } else {
          html += `\n        <img src="${escapeXHTML(url)}" alt="${title}" />`
        }
      }
      html += `\n      </div>`
      return html
    }
    case 'condition': {
      const expr = escapeXHTML(data.expression) || 'true'
      return `<p class="condition">⟲ 条件：${expr}</p>`
    }
    case 'unlock': {
      const title = escapeXHTML(data.title || data.nodeTitle) || '隐藏内容'
      const price = escapeXHTML(data.price ?? data.amount) || '0'
      return `<div class="unlock">\n        <h3>★ 解锁内容：${title}</h3>\n        <p class="price">支付：${price}元</p>\n      </div>`
    }
    case 'jump': {
      const label = escapeXHTML(data.label) || '跳转'
      return `<p class="jump">↻ 跳转：${label}</p>`
    }
    case 'gather': {
      const label = escapeXHTML(data.label) || '汇聚'
      return `<p class="gather">≈ 汇聚：${label}</p>`
    }
    case 'random': {
      const options = (data.options as Array<{ label?: string; weight?: number }>) || []
      const opts = options
        .map(
          (opt, i) =>
            `<li class="random-opt">· ${escapeXHTML(opt.label || `选项 ${i + 1}`)} (权重 ${opt.weight ?? 0})</li>`
        )
        .join('\n        ')
      return `<p class="random">⚂ 随机：</p>\n      <ul class="random-list">\n        ${opts}\n      </ul>`
    }
    default:
      return ''
  }
}

// 将节点列表切分为章节
function splitIntoChapters(
  nodes: StoryNode[],
  ctx: { characters: StoryCharacter[]; scenes?: ComicScene[] }
): Chapter[] {
  const chapters: Chapter[] = []
  let current: StoryNode[] = []
  let currentTitle = '序章'
  let chapterIndex = 0
  let lastSceneId: string | null = null

  const flush = () => {
    if (current.length === 0) return
    chapterIndex++
    const id = `chapter-${chapterIndex}`
    const title = currentTitle
    const body = current
      .map((n) => `      ${nodeToXHTML(n, ctx)}`)
      .join('\n\n')
    const xhtml = buildChapterXHTML(title, body)
    chapters.push({ id, title, xhtml })
    current = []
  }

  for (const node of nodes) {
    // 场景切换：开新章节
    const scene = resolveScene(node, ctx.scenes)
    if (scene && scene.id !== lastSceneId && current.length > 0) {
      flush()
      currentTitle = scene.name || `第 ${chapterIndex + 1} 章`
      lastSceneId = scene.id
    } else if (scene) {
      lastSceneId = scene.id
      if (current.length === 0) {
        currentTitle = scene.name || `第 ${chapterIndex + 1} 章`
      }
    }

    // 结局节点：作为章节结尾
    current.push(node)
    if (node.type === 'ending') {
      const endingTitle = (node.data as Record<string, unknown>).title as string
      if (endingTitle) currentTitle = `结局：${endingTitle}`
      flush()
    }
  }
  flush()

  // 若没有任何节点，至少生成一个空章节
  if (chapters.length === 0) {
    chapters.push({
      id: 'chapter-1',
      title: '空故事',
      xhtml: buildChapterXHTML('空故事', '<p>暂无内容</p>'),
    })
  }

  return chapters
}

// 章节 XHTML 模板
function buildChapterXHTML(title: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>${escapeXHTML(title)}</title>
    <link rel="stylesheet" type="text/css" href="style.css" />
  </head>
  <body>
    <h2>${escapeXHTML(title)}</h2>
${body}
  </body>
</html>`
}

// 章节样式表
function buildStyleCSS(): string {
  return `body { font-family: 'PingFang SC', 'Microsoft YaHei', 'Noto Serif SC', serif; line-height: 1.8; color: #1f2937; background: #fafafa; padding: 1em; }
h2 { color: #b45309; border-bottom: 2px solid #d4a574; padding-bottom: 0.3em; margin-bottom: 1em; }
h3 { color: #92400e; margin-top: 1em; }
p.dialogue { margin: 0.5em 0; padding: 0.3em 0.5em; background: #fff; border-left: 3px solid #92400e; }
p.dialogue .character { color: #b45309; font-weight: bold; }
p.narration { color: #6b7280; font-style: italic; margin: 0.5em 0 0.5em 1em; border-left: 2px dashed #9ca3af; padding-left: 0.5em; }
p.scene { color: #7c2d12; font-weight: bold; margin: 1em 0 0.3em; background: #fef3c7; padding: 0.2em 0.5em; border-radius: 3px; }
p.choice-prompt { color: #c2410c; font-weight: bold; margin: 0.8em 0 0.3em; }
ul.choices, ul.random-list { list-style: none; padding-left: 1.5em; margin: 0.3em 0; }
li.choice, li.random-opt { margin: 0.2em 0; color: #9a3412; }
div.ending { background: #fef9c3; border: 2px solid #ca8a04; padding: 0.8em; margin: 1em 0; border-radius: 4px; }
div.ending h3 { color: #854d0e; margin-top: 0; }
div.ending .ending-type { font-size: 0.8em; color: #a16207; text-transform: uppercase; letter-spacing: 1px; }
div.cg { background: #f3e8ff; border-left: 4px solid #a855f7; padding: 0.5em 0.8em; margin: 0.8em 0; }
div.cg img { max-width: 100%; height: auto; display: block; margin: 0.5em auto; }
div.cg .media-placeholder { color: #7e22ce; font-style: italic; text-align: center; padding: 1em; background: #faf5ff; border: 1px dashed #c084fc; }
div.unlock { background: #fef2f2; border: 2px dashed #dc2626; padding: 0.8em; margin: 1em 0; text-align: center; }
div.unlock .price { color: #dc2626; font-weight: bold; font-size: 1.2em; }
p.condition, p.jump, p.gather, p.random { color: #6b7280; font-style: italic; margin: 0.5em 0; padding: 0.2em 0.5em; background: #f3f4f6; border-radius: 3px; }
`
}

// 构建封面 XHTML 页（可选）
function buildCoverXHTML(coverImageHref: string | null, title: string, author: string): string {
  const imgTag = coverImageHref ? `<img src="${escapeXHTML(coverImageHref)}" alt="封面" class="cover-image" />` : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>封面</title>
    <link rel="stylesheet" type="text/css" href="style.css" />
  </head>
  <body class="cover-page">
    ${imgTag}
    <h1 class="book-title">${escapeXHTML(title)}</h1>
    <p class="book-author">${escapeXHTML(author)}</p>
  </body>
</html>`
}

// 构建内容导航（toc.ncx）
function buildTOCNCX(title: string, chapters: Chapter[], coverId: string | null): string {
  const navPoints = chapters
    .map((ch, i) => {
      const nav = `    <navPoint id="${ch.id}" playOrder="${i + (coverId ? 2 : 1)}">
      <navLabel><text>${escapeXHTML(ch.title)}</text></navLabel>
      <content src="${ch.id}.xhtml" />
    </navPoint>`
      return nav
    })
    .join('\n')

  const coverNav = coverId
    ? `    <navPoint id="${coverId}" playOrder="1">
      <navLabel><text>封面</text></navLabel>
      <content src="${coverId}.xhtml" />
    </navPoint>
`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtc:generator" content="SubSilicon Editor" />
  </head>
  <docTitle><text>${escapeXHTML(title)}</text></docTitle>
  <navMap>
${coverNav}${navPoints}
  </navMap>
</ncx>`
}

// 构建 content.opf 清单
function buildContentOPF(params: {
  title: string
  author: string
  description: string
  uuid: string
  chapters: Chapter[]
  coverId: string | null
  coverImageId: string | null
  coverImageMime: string | null
}): string {
  const { title, author, description, uuid, chapters, coverId, coverImageId, coverImageMime } = params
  const today = new Date().toISOString().split('T')[0]

  const coverManifest = coverId ? `    <item id="${coverId}" href="${coverId}.xhtml" media-type="application/xhtml+xml" />\n` : ''
  const coverImageManifest = coverImageId
    ? `    <item id="${coverImageId}" href="${coverImageId}.${(coverImageMime || 'image/jpeg').split('/')[1] || 'jpg'}" media-type="${coverImageMime || 'image/jpeg'}" properties="cover-image" />\n`
    : ''
  const styleManifest = `    <item id="style" href="style.css" media-type="text/css" />\n`
  const ncxManifest = `    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />\n`

  const chapterManifest = chapters
    .map((ch) => `    <item id="${ch.id}" href="${ch.id}.xhtml" media-type="application/xhtml+xml" />`)
    .join('\n')

  const spineItems = [
    ...(coverId ? [coverId] : []),
    ...chapters.map((ch) => ch.id),
  ]
    .map((id) => `    <itemref idref="${id}" />`)
    .join('\n')

  const metaCoverImage = coverImageId
    ? `    <meta name="cover" content="${coverImageId}" />\n`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${escapeXHTML(title)}</dc:title>
    <dc:creator>${escapeXHTML(author)}</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:identifier id="bookid">urn:uuid:${uuid}</dc:identifier>
    <dc:date>${today}</dc:date>
    ${description ? `<dc:description>${escapeXHTML(description)}</dc:description>` : ''}
${metaCoverImage}  </metadata>
  <manifest>
${coverManifest}${coverImageManifest}${styleManifest}${chapterManifest}
${ncxManifest}  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`
}

// 构建 container.xml
function buildContainerXML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`
}

// 简单的 UUID 生成（无外部依赖）
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // fallback：基于时间戳和随机数
  const ts = Date.now().toString(16)
  const rnd = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  return `${ts.slice(0, 8)}-${rnd.slice(0, 4)}-4${rnd.slice(4, 7)}-a${rnd.slice(7, 10)}-${rnd.slice(10, 22)}`
}

// 导出为 EPUB 文件（Blob）
export async function exportToEPUB(graph: StoryGraph): Promise<Blob> {
  const nodes = graph.nodes || []
  const edges = graph.edges || []
  const characters = graph.characters || []
  const scenes = graph.scenes

  const title = graph.title || '未命名故事'
  const description = graph.description || ''
  const author = 'SubSilicon 创作者'

  // 拓扑排序
  const sortedNodes = topologicalSortNodes(nodes, edges)
  const ctx = { characters, scenes }

  // 切分章节
  const chapters = splitIntoChapters(sortedNodes, ctx)

  // 处理封面图（settings.coverImage）
  const settings = graph.settings as { coverImage?: string }
  const coverDataUrl = settings?.coverImage
  let coverImageId: string | null = null
  let coverImageMime: string | null = null
  let coverImageBytes: Uint8Array | null = null
  let coverImageExt = 'jpg'

  if (coverDataUrl && coverDataUrl.startsWith('data:')) {
    const parsed = dataURLToBinary(coverDataUrl)
    if (parsed) {
      coverImageId = 'cover-image'
      coverImageMime = parsed.mime
      coverImageBytes = parsed.bytes
      coverImageExt = parsed.mime.split('/')[1] || 'jpg'
    }
  }

  const coverId = 'cover'
  const coverImageHref = coverImageId ? `${coverImageId}.${coverImageExt}` : null
  const coverXHTML = buildCoverXHTML(coverImageHref, title, author)

  // 构建 OPF 与 NCX
  const uuid = generateUUID()
  const contentOPF = buildContentOPF({
    title,
    author,
    description,
    uuid,
    chapters,
    coverId,
    coverImageId,
    coverImageMime,
  })
  const tocNCX = buildTOCNCX(title, chapters, coverId)

  // 组装 ZIP
  const zip = new JSZip()

  // mimetype 必须是第一个文件，且不压缩
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })

  // META-INF
  zip.file('META-INF/container.xml', buildContainerXML())

  // OEBPS
  const oebps = zip.folder('OEBPS')!
  oebps.file('content.opf', contentOPF)
  oebps.file('toc.ncx', tocNCX)
  oebps.file('style.css', buildStyleCSS())
  oebps.file(`${coverId}.xhtml`, coverXHTML)
  chapters.forEach((ch) => {
    oebps.file(`${ch.id}.xhtml`, ch.xhtml)
  })
  if (coverImageId && coverImageBytes) {
    oebps.file(`${coverImageId}.${coverImageExt}`, coverImageBytes)
  }

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

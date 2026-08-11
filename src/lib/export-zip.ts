import JSZip from 'jszip'
import { exportToHTML } from './export-html'
import type { StoryGraph } from '@editor/types/editor'
import type { MonetizationConfig } from '@editor/lib/work-monetization'

/** 收集付费节点 id（paidNodes + paidChapters） */
function collectPaidNodeIds(graph: StoryGraph): Set<string> {
  const monetization = graph.monetization as MonetizationConfig | undefined
  const ids = new Set<string>()
  if (!monetization?.enabled) return ids
  for (const id of monetization.paidNodes || []) ids.add(id)
  for (const ch of monetization.paidChapters || []) {
    for (const id of ch.nodeIds || []) ids.add(id)
  }
  return ids
}

/**
 * 构建分发版 graph：付费节点内容置为占位。
 * story.json 与 HTML 一样是分发物，不能携带付费节点明文，
 * 否则解压 ZIP 即可免费读取全部付费内容。
 */
function sanitizeGraphForDistribution(graph: StoryGraph, paidIds: Set<string>): StoryGraph {
  if (paidIds.size === 0) return graph
  const nodes = (graph.nodes || []).map((node) => {
    if (!paidIds.has(node.id)) return node
    return { ...node, data: { locked: true, label: '付费内容' } }
  })
  return { ...graph, nodes }
}

function extractAssets(graph: StoryGraph, paidIds: Set<string> = new Set()): Array<{ name: string; blob: Blob }> {
  const assets: Array<{ name: string; blob: Blob }> = []
  let audioIndex = 0
  let imageIndex = 0

  // 从 dataURL 提取资源的辅助函数
  function extractDataURL(dataURL: string, prefix: string): { name: string; blob: Blob } | null {
    if (!dataURL || !dataURL.startsWith('data:')) return null
    try {
      const [mimeType, content] = dataURL.split(',')
      const mime = mimeType.match(/:(.*?);/)?.[1] || 'application/octet-stream'
      const binary = atob(content)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const ext = mime.split('/')[1] || 'bin'
      return {
        name: `media/${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`,
        blob: new Blob([bytes], { type: mime }),
      }
    } catch {
      return null
    }
  }

  // 提取场景背景
  if (graph.scenes) {
    for (const scene of graph.scenes) {
      if (scene.backgroundImage) {
        const asset = extractDataURL(scene.backgroundImage, `scene_${scene.id}`)
        if (asset) assets.push(asset)
      }
    }
  }

  // 提取角色头像和立绘
  if (graph.characters) {
    for (const char of graph.characters) {
      if (char.avatar) {
        const asset = extractDataURL(char.avatar, `char_${char.id}_avatar`)
        if (asset) assets.push(asset)
      }
      if (char.sprites) {
        for (const sprite of char.sprites) {
          const url = sprite.url || sprite.image
          if (url) {
            const asset = extractDataURL(url, `char_${char.id}_sprite_${sprite.id || imageIndex++}`)
            if (asset) assets.push(asset)
          }
        }
      }
    }
  }

  // 提取节点资源（CG、音频、视频等）——付费节点资源不随 ZIP 分发
  if (graph.nodes) {
    for (const node of graph.nodes) {
      if (paidIds.has(node.id)) continue
      const data = node.data as Record<string, unknown> | undefined
      if (!data) continue

      // CG 图片
      if (data.url && typeof data.url === 'string') {
        const asset = extractDataURL(data.url, `cg_${node.id}`)
        if (asset) assets.push(asset)
      }

      // 音频字段
      const audioFields = ['bgm', 'bgs', 'seUrl', 'voiceUrl', 'audioUrl', 'musicUrl']
      for (const field of audioFields) {
        const url = data[field]
        if (typeof url === 'string' && url.startsWith('data:')) {
          const asset = extractDataURL(url, `audio_${field}_${audioIndex++}`)
          if (asset) assets.push(asset)
        }
      }

      // 封面图片
      if (data.coverImage && typeof data.coverImage === 'string') {
        const asset = extractDataURL(data.coverImage, `cover_${node.id}`)
        if (asset) assets.push(asset)
      }

      // 背景图片
      if (data.backgroundImage && typeof data.backgroundImage === 'string') {
        const asset = extractDataURL(data.backgroundImage, `bg_${node.id}`)
        if (asset) assets.push(asset)
      }

      // 角色立绘
      if (data.characterSprite && typeof data.characterSprite === 'string') {
        const asset = extractDataURL(data.characterSprite, `sprite_${node.id}`)
        if (asset) assets.push(asset)
      }
    }
  }

  return assets
}

function buildReadme(graph: StoryGraph): string {
  return `互动故事 - ${graph.title || '未命名故事'}
================================

使用说明：
1. 解压此 ZIP 文件到任意文件夹
2. 双击 index.html 即可在浏览器中阅读故事
3. media/ 文件夹包含故事中使用的图片和视频资源

故事信息：
- 标题：${graph.title || '未命名故事'}
- 节点数：${graph.nodes?.length || 0}
- 连线数：${graph.edges?.length || 0}
- 角色数：${graph.characters?.length || 0}

导出时间：${new Date().toLocaleString('zh-CN')}

由 SubSilicon 编辑器生成
`
}

export async function exportToZIP(graph: StoryGraph): Promise<Blob> {
  const zip = new JSZip()

  const paidIds = collectPaidNodeIds(graph)

  // index.html 同样使用付费内容打码后的副本：此前直接 exportToHTML(graph)，
  // 未传 monetization 导致 encryptPaidContent 被跳过、isNodeUnlocked 恒返回 true，
  // 付费节点文本与内嵌素材（dataURL）在 ZIP 内明文可见，story.json 打码被完全绕过。
  const html = await exportToHTML(sanitizeGraphForDistribution(graph, paidIds))
  zip.file('index.html', html)

  const assets = extractAssets(graph, paidIds)
  for (const asset of assets) {
    zip.file(asset.name, asset.blob)
  }

  // story.json 使用付费内容打码后的副本，付费节点明文不随 ZIP 分发
  zip.file('story.json', JSON.stringify(sanitizeGraphForDistribution(graph, paidIds), null, 2))
  zip.file('README.txt', buildReadme(graph))

  return await zip.generateAsync({ type: 'blob' })
}

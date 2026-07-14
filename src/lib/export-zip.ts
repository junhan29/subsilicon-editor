import JSZip from 'jszip'
import { exportToHTML } from './export-html'
import type { StoryGraph } from '@editor/types/editor'

function extractAssets(graph: StoryGraph): Array<{ name: string; blob: Blob }> {
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

  // 提取节点资源（CG、音频、视频等）
  if (graph.nodes) {
    for (const node of graph.nodes) {
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

  const html = await exportToHTML(graph)
  zip.file('index.html', html)

  const assets = extractAssets(graph)
  for (const asset of assets) {
    zip.file(asset.name, asset.blob)
  }

  zip.file('story.json', JSON.stringify(graph, null, 2))
  zip.file('README.txt', buildReadme(graph))

  return await zip.generateAsync({ type: 'blob' })
}

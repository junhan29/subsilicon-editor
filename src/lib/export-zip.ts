import JSZip from 'jszip'
import { exportToHTML } from './export-html'
import type { StoryGraph } from '@editor/types/editor'

function extractAssets(graph: StoryGraph): Array<{ name: string; blob: Blob }> {
  const assets: Array<{ name: string; blob: Blob }> = []

  if (graph.scenes) {
    for (const scene of graph.scenes) {
      if (scene.backgroundImage && scene.backgroundImage.startsWith('data:')) {
        const [mimeType, data] = scene.backgroundImage.split(',')
        const mime = mimeType.match(/:(.*?);/)?.[1] || 'image/png'
        const binary = atob(data)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        assets.push({
          name: `media/scene_${scene.id}.${mime.split('/')[1] || 'png'}`,
          blob: new Blob([bytes], { type: mime }),
        })
      }
    }
  }

  if (graph.nodes) {
    for (const node of graph.nodes) {
      const data = node.data as Record<string, unknown> | undefined
      if (data?.url && typeof data.url === 'string' && data.url.startsWith('data:')) {
        const [mimeType, content] = data.url.split(',')
        const mime = mimeType.match(/:(.*?);/)?.[1] || 'application/octet-stream'
        const binary = atob(content)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const ext = mime.split('/')[1] || 'bin'
        assets.push({
          name: `media/cg_${node.id}.${ext}`,
          blob: new Blob([bytes], { type: mime }),
        })
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

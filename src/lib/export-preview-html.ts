/**
 * 静态预览 HTML 导出
 *
 * 生成用于提交到网站名录的静态图文预览 HTML
 * 与普通 HTML 导出的区别：
 * - 仅静态图文展示，无交互
 * - 仅前 3 个节点内容
 * - 卡片式排版
 */

import type { StoryGraph, StoryNode } from '@editor/types/editor'

/**
 * 从 StoryGraph 中提取前 N 个节点的文字内容
 */
function extractPreviewNodes(graph: StoryGraph, count = 3): StoryNode[] {
  const nodes = graph.nodes || []
  // 按节点顺序取前 N 个对话/旁白节点
  const contentNodes = nodes.filter(n =>
    n.type === 'dialogue' || n.type === 'narration' || n.type === 'choice'
  )
  return contentNodes.slice(0, count)
}

/**
 * 获取节点文字内容
 */
function getNodeText(node: StoryNode): string {
  const data = node.data as any
  if (!data) return ''

  if (data.text) return data.text
  if (data.content) return data.content
  if (data.title) return data.title

  return ''
}

/**
 * 获取节点角色名
 */
function getNodeSpeaker(node: StoryNode): string {
  const data = node.data as any
  if (!data) return ''

  if (data.speaker) return data.speaker
  if (data.characterId) return data.characterId

  return ''
}

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * 导出静态预览 HTML
 */
export function exportPreviewHTML(graph: StoryGraph): string {
  const title = escapeHtml(graph.title || '未命名故事')
  const description = escapeHtml(graph.description || '')

  const previewNodes = extractPreviewNodes(graph, 3)

  // 构建章节内容
  const chapters = previewNodes.map((node, index) => {
    const text = escapeHtml(getNodeText(node))
    const speaker = escapeHtml(getNodeSpeaker(node))
    const chapterTitle = `第${['一', '二', '三'][index] || (index + 1)}章`

    const speakerHtml = speaker
      ? `<p class="speaker">${speaker}：</p>`
      : ''

    return `
      <div class="chapter">
        <h3>${chapterTitle}</h3>
        ${speakerHtml}
        <p class="content">${text}</p>
      </div>
    `
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - 预览</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      padding: 24px 16px;
      background: #fafafa;
      color: #333;
      line-height: 1.8;
    }
    .header { text-align: center; margin-bottom: 32px; }
    .title { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
    .description { color: #666; font-size: 14px; }
    .chapter {
      border-left: 3px solid #f59e0b;
      padding: 12px 16px;
      margin: 16px 0;
      background: white;
      border-radius: 0 8px 8px 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .chapter h3 { font-size: 14px; color: #f59e0b; margin-bottom: 8px; }
    .speaker { font-weight: 600; color: #555; font-size: 14px; }
    .content { font-size: 15px; color: #333; margin-top: 4px; }
    .cta {
      background: linear-gradient(135deg, #f59e0b, #f97316);
      color: white;
      padding: 16px;
      border-radius: 12px;
      text-align: center;
      margin-top: 32px;
      font-size: 14px;
    }
    .footer {
      text-align: center;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="title">${title}</h1>
    ${description ? `<p class="description">${description}</p>` : ''}
  </div>

  ${chapters}

  <div class="cta">
    想体验完整作品？联系作者获取
  </div>

  <div class="footer">
    由 SubSilicon Editor 生成 · <a href="https://subsilicon.cn" style="color: #f59e0b;">subsilicon.cn</a>
  </div>
</body>
</html>`
}

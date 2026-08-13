/**
 * B 站互动视频导出器
 *
 * B 站互动视频（互动分 P / CID 跳转）后台格式参考：
 *   - 创建互动视频时上传多个分 P（每个分 P 对应一个 graph 节点的视频素材）
 *   - 用「互动编辑」工具定义每个分 P 在指定秒数（通常末尾）弹出的选项：
 *     选项标题 + 跳转到哪个分 P（cid）
 *   - 或使用 B 站官方的 "互动脚本 CSV" 模板批量导入（工具 → 导入脚本）
 *
 * 本导出器输出两种交付物：
 *   A) manifest.json + 分P清单.csv  +  (可选) bash/ffmpeg 生成脚本
 *      - 创作者先准备好自己的实拍/AI 生成视频素材
 *      - manifest 里告诉「哪个节点对应哪个分 P / 时间戳跳转」
 *      - 创作者按清单把分 P 上传，再导入 CSV 配置选项
 *
 *   B) 伪互动 MP4 模式（一个单独视频 + 说明文件）
 *      - 给只愿意投「普通视频」但想模拟互动感的创作者
 *      - 通过章节（chapter）描述选项 + "请拖动到对应秒数" 的说明
 *      - 配合 pinned 评论 / 简介放跳转列表
 */
import JSZip from 'jszip'
import type { StoryEdge, StoryGraph, StoryNode } from '@editor/types/editor'

export interface VideoBinding {
  /** graph.nodeId */
  nodeId: string
  /** 素材路径或素材库 ID（纯字符串，不上传文件） */
  assetRef?: string
  /** 该节点对应视频的秒数时长（用于伪互动时间轴排布） */
  durationSec?: number
  /** 分 P 标题（B 站分 P 名，最长 80） */
  partTitle?: string
  /** 选项出现的秒数偏移（默认视频结尾前 5s），-1 表示不弹选项 */
  popupOffsetSec?: number
}

export interface BilibiliInteractiveOptions {
  workId: string
  workTitle: string
  /** 每个 node 的素材绑定；未绑定的节点用默认占位标题 */
  bindings?: VideoBinding[]
  /** 伪互动模式：把所有节点按遍历顺序拼成一个 MP4 时间轴 */
  pseudo?: boolean
  /** 伪互动默认每段占位时长（秒），当绑定未提供 duration 时使用 */
  defaultSegmentSec?: number
  /** B 站专栏 / 简介链接模板 */
  descriptionTemplate?: string
}

export interface BilibiliExportResult {
  /** zip 包含 manifest + 分P清单.csv + README + ffmpeg 脚本 */
  zip: Blob
  fileName: string
  /** 导出摘要 */
  summary: {
    nodes: number
    choices: number
    parts: number
    mode: 'interactive' | 'pseudo'
    missingBindings: string[]
    unboundPartTitles: string[]
  }
}

/**
 * B 站互动脚本 CSV 头部（2024 年官方模板版本，使用 UTF-8-SIG）
 * 列：
 *   标题,简介,封面,时长(秒),选项标题,跳转标题,跳转开始时间(秒),是否默认选项,选项出现时间(秒),选项显示时长(秒)
 *   注意：一个「分 P 行」后紧跟 N 行「选项行」（第一列空）
 */
const CSV_HEADER_BOM = '\uFEFF标题,简介,封面,时长(秒),选项标题,跳转标题,跳转开始时间(秒),是否默认选项,选项出现时间(秒),选项显示时长(秒)'

function safe<T>(x: T | undefined | null, fallback: T): T {
  return x === undefined || x === null ? fallback : x
}

function csvEscape(v: string | number | undefined): string {
  const s = v === undefined ? '' : String(v)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** 图的起点（找无入度节点或最小 id 的节点） */
function findStart(graph: StoryGraph): StoryNode {
  const nodes = graph.nodes
  if (!nodes.length) throw new Error('空图，无法导出互动视频')
  if (nodes.length === 1) return nodes[0]
  const inDegrees = new Map<string, number>()
  for (const n of nodes) inDegrees.set(n.id, 0)
  for (const e of graph.edges) inDegrees.set(e.target, (inDegrees.get(e.target) || 0) + 1)
  const roots = nodes.filter(n => (inDegrees.get(n.id) || 0) === 0)
  if (roots.length) return roots[0]
  return nodes[0]
}

/** 深度优先给节点分配分 P 顺序 */
function assignParts(graph: StoryGraph): { nodeId: string; partIndex: number; depth: number }[] {
  const nodes = graph.nodes
  const start = findStart(graph)
  const seen = new Map<string, { partIndex: number; depth: number }>()
  let idx = 0
  const stack: { id: string; depth: number }[] = [{ id: start.id, depth: 0 }]
  while (stack.length) {
    const cur = stack.pop()!
    if (seen.has(cur.id)) continue
    seen.set(cur.id, { partIndex: idx++, depth: cur.depth })
    const outs = graph.edges
      .filter(e => e.source === cur.id)
      .sort((a, b) => {
        const aw = typeof (a as any).sort === 'number' ? (a as any).sort : 0
        const bw = typeof (b as any).sort === 'number' ? (b as any).sort : 0
        return aw - bw
      })
    for (let i = outs.length - 1; i >= 0; i--) {
      stack.push({ id: outs[i].target, depth: cur.depth + 1 })
    }
  }
  // 未遍历到的节点（循环里的）追加到最后
  for (const n of nodes) {
    if (!seen.has(n.id)) seen.set(n.id, { partIndex: idx++, depth: 0 })
  }
  return [...seen.entries()].map(([nodeId, v]) => ({ nodeId, partIndex: v.partIndex, depth: v.depth }))
}

/** 主导出 */
export async function exportBilibiliInteractive(
  graph: StoryGraph,
  opts: BilibiliInteractiveOptions
): Promise<BilibiliExportResult> {
  const mode = opts.pseudo ? 'pseudo' : 'interactive'
  const bindingMap = new Map<string, VideoBinding>()
  const KB = 'videoBinding' as const
  for (const n of graph.nodes) {
    const raw = (n.data || {})[KB] as Partial<VideoBinding> | undefined
    if (raw && (raw.assetRef || raw.partTitle || raw.durationSec != null || raw.popupOffsetSec != null)) {
      bindingMap.set(n.id, { nodeId: n.id, ...raw })
    }
  }
  for (const b of opts.bindings || []) bindingMap.set(b.nodeId, { ...(bindingMap.get(b.nodeId) || { nodeId: b.nodeId }), ...b })
  const defaultSegSec = opts.defaultSegmentSec || 15

  const parts = assignParts(graph)
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  const partTitleByNodeId = new Map<string, string>()
  const partIndexByNodeId = new Map<string, number>()
  for (const p of parts) {
    partIndexByNodeId.set(p.nodeId, p.partIndex)
    const node = nodeById.get(p.nodeId)!
    const data = (node.data || {}) as { title?: string }
    const b = bindingMap.get(p.nodeId)
    const fallback = p.partIndex === 0 ? 'P1 开头：' + (data.title || '序章') : `P${p.partIndex + 1} ${data.title || node.id}`
    const t = b?.partTitle || fallback
    partTitleByNodeId.set(p.nodeId, t.slice(0, 80))
  }

  const missingBindings: string[] = []
  const unboundPartTitles: string[] = []
  for (const n of graph.nodes) {
    if (!bindingMap.has(n.id)) {
      missingBindings.push(n.id)
      unboundPartTitles.push(partTitleByNodeId.get(n.id) || n.id)
    }
  }

  // 读取节点文本（兼容多种字段）
  const nodeText = (n: StoryNode, max = 200): string => {
    const d = (n.data || {}) as any
    const raw = [d.text, d.content, d.subtitle, d.description, d.title].find((x: unknown) => typeof x === 'string' && x.length > 0) as string | undefined
    return (raw || '').replace(/\s+/g, ' ').slice(0, max)
  }

  // CSV
  const csvRows: string[] = [CSV_HEADER_BOM]
  for (const p of parts) {
    const node = nodeById.get(p.nodeId)!
    const b = bindingMap.get(p.nodeId)
    const title = partTitleByNodeId.get(p.nodeId)!
    const descr = nodeText(node, 200)
    const duration = Math.max(1, Math.round(b?.durationSec || defaultSegSec))
    const popupOffset = b?.popupOffsetSec
    const popupAt = popupOffset == null || popupOffset === -1 ? Math.max(0, duration - 5) : Math.min(Math.max(0, popupOffset), Math.max(0, duration - 1))

    csvRows.push([
      csvEscape(title),
      csvEscape(descr),
      csvEscape(''),          // 封面，用户在 B 站后台替换
      csvEscape(duration),
      '', '', '', '', '', '', // 选项行填在下面
    ].join(','))

    const outs = graph.edges
      .filter(e => e.source === p.nodeId)
      .sort((a, b) => {
        const aw = typeof (a as any).sort === 'number' ? (a as any).sort : 0
        const bw = typeof (b as any).sort === 'number' ? (b as any).sort : 0
        return aw - bw
      })
    if (!outs.length) {
      // 结局分 P：无选项
      continue
    }
    outs.forEach((e, i) => {
      const toTitle = partTitleByNodeId.get(e.target) || `[缺失节点] ${e.target}`
      const label = e.label || (e.data && e.data.label) || `选项${i + 1}`
      const isDefault = i === 0 && outs.length > 1 ? '是' : ''
      csvRows.push([
        '', '', '', '',
        csvEscape(label.slice(0, 30)),
        csvEscape(toTitle),
        csvEscape(0),        // 跳到目标 P 的 0 秒
        csvEscape(isDefault),
        csvEscape(Math.round(popupAt)),
        csvEscape(duration - popupAt || 5),
      ].join(','))
    })
  }

  // 分P清单
  const partList: string[] = ['序号,分P标题,节点ID,素材绑定,占位时长(s),节点内容摘录']
  for (const p of parts) {
    const node = nodeById.get(p.nodeId)!
    const b = bindingMap.get(p.nodeId)
    partList.push([
      p.partIndex + 1,
      partTitleByNodeId.get(p.nodeId),
      p.nodeId,
      b?.assetRef || '(未绑定，请准备素材后再替换)',
      Math.round(b?.durationSec || defaultSegSec),
      csvEscape(nodeText(node, 60)),
    ].map(x => csvEscape(x)).join(','))
  }

  // manifest.json（机器可读）
  const manifest = {
    schema: 'bilibili-interactive@1.0',
    mode,
    workId: opts.workId,
    workTitle: opts.workTitle,
    generatedAt: new Date().toISOString(),
    parts: parts.map(p => {
      const b = bindingMap.get(p.nodeId)
      const node = nodeById.get(p.nodeId)!
      const data = (node.data || {}) as { title?: string }
      const outs = graph.edges.filter(e => e.source === p.nodeId)
      return {
        partIndex: p.partIndex,
        partTitle: partTitleByNodeId.get(p.nodeId),
        nodeId: p.nodeId,
        nodeTitle: data.title || '',
        assetRef: b?.assetRef,
        durationSec: Math.round(b?.durationSec || defaultSegSec),
        popupOffsetSec: b?.popupOffsetSec,
        choices: outs.map((e, i) => ({
          optionIndex: i,
          label: e.label || (e.data && e.data.label) || `选项${i + 1}`,
          goto: e.target,
          gotoPartIndex: partIndexByNodeId.get(e.target),
        })),
        isEnding: outs.length === 0,
      }
    }),
    startNodeId: findStart(graph).id,
    stats: {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      choices: graph.edges.length,
      endings: graph.nodes.filter(n => !graph.edges.some(e => e.source === n.id)).length,
    },
  }

  // README.txt
  const readme = buildReadme(opts, manifest, missingBindings, unboundPartTitles)

  // FFMPEG 拼接脚本（伪互动模式）
  const { ffmpegSh, pseudoChapters } = buildPseudoArtifacts(manifest, opts, defaultSegSec)

  // 组装 zip
  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  zip.file('README.txt', readme)
  zip.file('bilibili-interactive-script.csv', csvRows.join('\n'))
  zip.file('分P清单.csv', partList.join('\n'))
  if (mode === 'pseudo') {
    zip.file('pseudo-chapters.csv', pseudoChapters)
    zip.file('ffmpeg-concat.sh', ffmpegSh)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  return {
    zip: zipBlob,
    fileName: `${safeFilename(opts.workTitle)}-bilibili-${mode}.zip`,
    summary: {
      nodes: graph.nodes.length,
      choices: graph.edges.length,
      parts: parts.length,
      mode,
      missingBindings,
      unboundPartTitles,
    },
  }
}

function safeFilename(s: string): string {
  // eslint-disable-next-line no-control-regex
  return (s || 'subsilicon-work').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 60) || 'subsilicon-work'
}

function buildReadme(
  opts: BilibiliInteractiveOptions,
  manifest: ReturnType<typeof JSON.parse> extends never ? never : any,
  missingBindings: string[],
  unboundPartTitles: string[],
): string {
  const lines: string[] = []
  lines.push('【SubSilicon → B 站互动视频 导出包】')
  lines.push('作品：' + opts.workTitle + '（' + manifest.mode + ' 模式）')
  lines.push('生成时间：' + manifest.generatedAt)
  lines.push('')
  lines.push('【文件说明】')
  lines.push('  - bilibili-interactive-script.csv：B 站互动脚本（CSV），用于在 B 站互动编辑器「导入脚本」')
  lines.push('  - 分P清单.csv：给你/剪辑师的分 P 作业清单，逐个填素材后替换')
  lines.push('  - manifest.json：机器可读，含每个 P 的选项跳转，方便二次开发')
  if (manifest.mode === 'pseudo') {
    lines.push('  - pseudo-chapters.csv：普通视频章节列表（配合简介/置顶评论使用）')
    lines.push('  - ffmpeg-concat.sh：ffmpeg 一键拼接脚本 + 章节嵌入参考')
  }
  lines.push('')
  lines.push('【标准 B 站互动视频 上传步骤（interactive 模式）】')
  lines.push('  1. 打开 B 站创作者中心 → 发布视频 → 选择「互动视频」')
  lines.push('  2. 按 分P清单.csv 准备每个分 P 的视频文件（mp4, 1080p 建议码率 8Mbps）')
  lines.push('  3. 把所有分 P 一次性上传到同一个稿件里（分 P 顺序 = 清单的序号顺序）')
  lines.push('  4. 进入互动编辑 → 脚本编辑 → 导入 CSV → 选择 bilibili-interactive-script.csv')
  lines.push('  5. 导入成功后，检查：每个 P 的封面、选项文案、跳转是否正确')
  lines.push('  6. 上传每个 P 的封面、写简介、分类 → 发布')
  lines.push('')
  lines.push('【伪互动 单视频 发布步骤（pseudo 模式）】')
  lines.push('  1. 把所有节点视频素材按 pseudo-chapters.csv 顺序准备好')
  lines.push('  2. 使用 ffmpeg-concat.sh 一键拼接并嵌入章节（或用 Premiere 剪）')
  lines.push('  3. 把 pseudo-chapters.csv 的章节表复制到视频简介；置顶评论把关键分支二次列出')
  lines.push('  4. 发布普通视频，引导观众「拖动进度条 / 点章节跳转」')
  lines.push('')
  if (missingBindings.length) {
    lines.push('【⚠️  仍未绑定视频素材的节点】（共 ' + missingBindings.length + ' 个）')
    unboundPartTitles.slice(0, 30).forEach(t => lines.push('  - ' + t))
    if (unboundPartTitles.length > 30) lines.push('  ……另 ' + (unboundPartTitles.length - 30) + ' 个见 manifest.json')
    lines.push('→ 请回到编辑器的「每个节点 → 视频素材」Tab，把素材绑定后重新导出。')
    lines.push('')
  }
  lines.push('【常见问题】')
  lines.push('  Q: CSV 导入后中文乱码？   A: 确认使用 UTF-8-BOM 版本；WPS/Excel 打开再另存为 CSV(UTF-8) 即可。')
  lines.push('  Q: 分 P 顺序在 B 站显示不对？A: 分 P 顺序要和 分P清单.csv 严格一致，上传时按序号拖好位置。')
  lines.push('  Q: 结局无选项被提示缺失？ A: 正常，B 站互动允许结局分 P 不设选项。')
  lines.push('')
  lines.push('— SubSilicon Team')
  return lines.join('\n')
}

function buildPseudoArtifacts(manifest: any, opts: BilibiliInteractiveOptions, defaultSegSec: number): { ffmpegSh: string; pseudoChapters: string } {
  const segs: Array<{ partIndex: number; title: string; start: number; end: number; asset?: string }> = []
  let t = 0
  for (const p of manifest.parts) {
    const dur = p.durationSec || defaultSegSec
    segs.push({ partIndex: p.partIndex, title: p.partTitle || `P${p.partIndex + 1}`, start: t, end: t + dur, asset: p.assetRef })
    t += dur
  }
  const fmt = (sec: number) => {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  const chapters: string[] = ['章节顺序(伪互动),起始时间,结束时间,分P标题,对应素材,跳转说明']
  for (const seg of segs) {
    const p = manifest.parts[seg.partIndex]
    const jumpNote = p && p.choices && p.choices.length
      ? p.choices.map((c: any, i: number) => `选项${i + 1}「${c.label}」→ 跳至 ${fmt(manifest.parts[c.gotoPartIndex || 0].start || 0)}`).join('；')
      : '（结局）'
    chapters.push([
      csvEscape(seg.partIndex + 1),
      csvEscape(fmt(seg.start)),
      csvEscape(fmt(seg.end)),
      csvEscape(seg.title),
      csvEscape(seg.asset || ''),
      csvEscape(jumpNote),
    ].join(','))
  }

  // FFMPEG 脚本：concat demuxer。需要用户把素材放 ./segments/P<idx>.mp4
  const sh: string[] = []
  sh.push('#!/usr/bin/env bash')
  sh.push('# SubSilicon 伪互动 MP4 拼接脚本（需要 ffmpeg 5.0+）')
  sh.push('# 用法：把每个节点的视频素材依次放到 ./segments/P1.mp4, P2.mp4, ... （与 manifest.partIndex+1 对应）')
  sh.push('#       缺少的素材会用 ffmpeg 画一个 1080p 黑色占位 + 分 P 标题文字代替。')
  sh.push('set -euo pipefail')
  sh.push('')
  sh.push('OUT="pseudo-' + safeFilename(opts.workTitle) + '.mp4"')
  sh.push('mkdir -p segments _tmp')
  sh.push('')
  // 对每个 seg：若有素材跳过；否则生成占位
  segs.forEach((seg) => {
    const idx = seg.partIndex + 1
    const dur = seg.end - seg.start
    sh.push(`# P${idx}  ${seg.title}  (${dur}s)`)
    sh.push(`if [ ! -f segments/P${idx}.mp4 ]; then`)
    const safeTitle = (seg.title || `P${idx}`).replace(/'/g, "'\\''")
    sh.push(`  ffmpeg -y -f lavfi -i "color=c=0x111827:s=1920x1080:d=${dur}:r=24" \\`)
    sh.push(`    -f lavfi -i "anullsrc=r=44100:cl=stereo:d=${dur}" \\`)
    sh.push(`    -vf "drawtext=fontsize=64:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:text='${safeTitle}'" \\`)
    sh.push(`    -shortest -c:v libx264 -preset medium -crf 22 -c:a aac -b:a 160k segments/P${idx}.mp4 < /dev/null`)
    sh.push('fi')
    sh.push(`ffprobe -v error -show_entries format=duration -of csv=p=0 segments/P${idx}.mp4 > _tmp/P${idx}.dur`)
    sh.push('')
  })
  sh.push('# 写 concat list')
  sh.push(': > _tmp/concat.txt')
  segs.forEach((seg) => {
    const idx = seg.partIndex + 1
    sh.push(`echo "file '$(pwd)/segments/P${idx}.mp4'" >> _tmp/concat.txt`)
  })
  sh.push('')
  sh.push('# 拼接')
  sh.push('ffmpeg -y -f concat -safe 0 -i _tmp/concat.txt -c copy -movflags +faststart "_tmp/concat.mp4" < /dev/null')
  sh.push('')
  sh.push('#（可选）章节元数据：见 pseudo-chapters.csv，可用第三方工具或 ffmpeg -i in.mp4 -i chapters.ffmetadata -map_metadata 1 -c copy out.mp4 嵌入')
  sh.push('mv "_tmp/concat.mp4" "$OUT"')
  sh.push('echo "✅  完成：$OUT"')
  sh.push('echo "   章节列表见 pseudo-chapters.csv，请手动复制到视频简介 / 置顶评论。"')

  return { ffmpegSh: sh.join('\n'), pseudoChapters: chapters.join('\n') }
}

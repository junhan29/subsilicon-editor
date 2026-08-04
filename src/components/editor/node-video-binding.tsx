/**
 * 单节点的视频素材绑定（折叠块）
 * 用于 B 站互动视频 / 伪互动模式导出时，把节点与具体视频素材绑定。
 * 数据持久化到 node.data.videoBinding，无需额外 store。
 */
import { useState } from 'react'
import { Film, ChevronDown, ChevronRight } from 'lucide-react'
import { Label } from '@editor/components/ui/label'
import { Input } from '@editor/components/ui/input'
import type { StoryNode } from '@editor/types/editor'
import type { VideoBinding } from '@editor/lib/export-bilibili-interactive'

const KEY = 'videoBinding'

function readBinding(node: StoryNode): VideoBinding & { __partTitle?: string } {
  const anyData = (node.data || {}) as any
  const raw: Partial<VideoBinding> = (anyData[KEY] || {}) as Partial<VideoBinding>
  return {
    nodeId: node.id,
    assetRef: raw.assetRef ?? '',
    durationSec: raw.durationSec ?? undefined,
    partTitle: raw.partTitle ?? undefined,
    popupOffsetSec: raw.popupOffsetSec ?? undefined,
  }
}

interface NodeVideoBindingSectionProps {
  node: StoryNode
  onUpdateNode: (nodeId: string, patch: Partial<StoryNode['data']>) => void
}

export function NodeVideoBindingSection({ node, onUpdateNode }: NodeVideoBindingSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const b = readBinding(node)

  const patch = (k: keyof VideoBinding, v: any) => {
    const cur = (node.data?.[KEY] as Partial<VideoBinding>) || {}
    const next: Partial<VideoBinding> = { ...cur, [k]: v }
    if (v === '' || v === undefined || v === null) delete (next as any)[k]
    onUpdateNode(node.id, { [KEY]: Object.keys(next).length ? next : undefined })
  }

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden bg-background">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors text-left"
      >
        <Film className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-[11px] font-medium">视频素材绑定（B 站互动视频导出用）</span>
        {b.assetRef || b.durationSec || b.partTitle ? (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            已绑定
          </span>
        ) : null}
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ml-auto shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/40 pt-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">分 P 标题（建议 ≤ 20 字）</Label>
            <Input
              value={b.partTitle || ''}
              onChange={(e) => patch('partTitle', e.target.value || undefined)}
              placeholder="可选，默认用节点标题"
              className="h-7 text-xs mt-1"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">素材绑定（素材库 ID / 本地路径 / 备注）</Label>
            <Input
              value={b.assetRef || ''}
              onChange={(e) => patch('assetRef', e.target.value || undefined)}
              placeholder="例如：D:/video/P012_scene_ending_A.mp4"
              className="h-7 text-xs mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">时长(秒)</Label>
              <Input
                type="number"
                min={1}
                max={3600}
                value={b.durationSec == null ? '' : b.durationSec}
                onChange={(e) => patch('durationSec', e.target.value === '' ? undefined : Math.max(1, Math.min(3600, Number(e.target.value))))}
                placeholder="默认 15"
                className="h-7 text-xs mt-1 text-center"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">选项弹出(秒偏移)</Label>
              <Input
                type="number"
                min={-1}
                max={3600}
                value={b.popupOffsetSec == null ? '' : b.popupOffsetSec}
                onChange={(e) => patch('popupOffsetSec', e.target.value === '' ? undefined : Number(e.target.value))}
                placeholder="-1 不弹出"
                className="h-7 text-xs mt-1 text-center"
              />
              <p className="text-[9px] text-muted-foreground mt-0.5">默认结尾前 5 秒</p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed pt-1">
            在「导出 → B 站互动视频 / 伪互动」时会自动读取本节点的绑定数据；未绑定时用默认占位排期。
          </p>
        </div>
      )}
    </div>
  )
}

/** 从当前 graph 收集所有节点的绑定数据（导出时调用） */
export function collectAllVideoBindingsFromGraph(graph: {
  nodes: Array<Pick<StoryNode, 'id' | 'data'>>
}): VideoBinding[] {
  const out: VideoBinding[] = []
  for (const n of graph.nodes) {
    const anyData = (n.data || {}) as any
    const raw: Partial<VideoBinding> = (anyData[KEY] || {}) as Partial<VideoBinding>
    if (!raw || (!raw.assetRef && !raw.partTitle && raw.durationSec == null && raw.popupOffsetSec == null)) continue
    out.push({
      nodeId: n.id,
      assetRef: raw.assetRef,
      durationSec: raw.durationSec,
      partTitle: raw.partTitle,
      popupOffsetSec: raw.popupOffsetSec,
    })
  }
  return out
}

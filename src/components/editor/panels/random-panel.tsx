'use client'

import { Label } from '@editor/components/ui/label'
import { Input } from '@editor/components/ui/input'
import type { BasePanelProps } from './shared-props'

export function RandomPanel({ node, onUpdateNode }: BasePanelProps) {
  const { data, id } = node

  return (
    <>
      <div className="space-y-2">
        <Label className="text-xs">节点标签</Label>
        <Input
          value={(data as any).label || ''}
          onChange={(e) => onUpdateNode(id, { ...data, label: e.target.value })}
          placeholder="随机分支"
          className="text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">随机权重配置（可选）</Label>
        <p className="text-[10px] text-muted-foreground">
          可为每条出边配置权重值，影响随机概率。若不配置，所有分支等概率。
        </p>
      </div>
      <p className="text-[10px] text-muted-foreground">
        随机节点会随机选择一条出边执行，适合实现随机事件或多样性剧情。
      </p>
    </>
  )
}
'use client'

import { Label } from '@editor/components/ui/label'
import { Input } from '@editor/components/ui/input'
import type { BasePanelProps } from './shared-props'

export function GatherPanel({ node, onUpdateNode }: BasePanelProps) {
  const { data, id } = node

  return (
    <>
      <div className="space-y-2">
        <Label className="text-xs">节点标签</Label>
        <Input
          value={(data as any).label || ''}
          onChange={(e) => onUpdateNode(id, { ...data, label: e.target.value })}
          placeholder="汇聚点"
          className="text-sm"
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        汇聚节点用于将多条分支线路汇合到一起，本身不显示内容。
      </p>
    </>
  )
}
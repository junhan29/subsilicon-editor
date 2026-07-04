'use client'

import { Label } from '@editor/components/ui/label'
import { Input } from '@editor/components/ui/input'
import type { BasePanelProps } from './shared-props'

export function JumpPanel({ node, onUpdateNode }: BasePanelProps) {
  const { data, id } = node

  return (
    <>
      <div className="space-y-2">
        <Label className="text-xs">跳转目标节点ID</Label>
        <Input
          value={(data as any).targetNodeId || ''}
          onChange={(e) => onUpdateNode(id, { ...data, targetNodeId: e.target.value })}
          placeholder="输入目标节点的ID"
          className="text-sm font-mono"
        />
        <p className="text-[10px] text-muted-foreground">
          填写要跳转到的节点的 ID，实现非线性跳转
        </p>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">跳转标签（可选）</Label>
        <Input
          value={(data as any).label || ''}
          onChange={(e) => onUpdateNode(id, { ...data, label: e.target.value })}
          placeholder="如：返回起点"
          className="text-sm"
        />
      </div>
    </>
  )
}
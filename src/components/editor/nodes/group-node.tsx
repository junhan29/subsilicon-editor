'use client'

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { ChevronDown, ChevronRight, Pencil, Check, X } from 'lucide-react'
import { areNodesEqual } from '@editor/lib/utils'
import { GROUP_COLORS } from '@editor/types/editor'

interface GroupNodeData {
  name: string
  color: string
  collapsed: boolean
  nodeCount: number
  onToggleCollapse?: (groupId: string) => void
  onRename?: (groupId: string, name: string) => void
  onColorChange?: (groupId: string, color: string) => void
  onDelete?: (groupId: string) => void
}

function GroupNodeComponent({ data, selected, id }: { data: GroupNodeData; selected: boolean; id: string }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(data.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const colorInfo = GROUP_COLORS.find(c => c.value === data.color) || GROUP_COLORS[0]

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setEditName(data.name)
    setIsEditing(true)
  }, [data.name])

  const handleSaveName = useCallback(() => {
    if (editName.trim() && editName !== data.name) {
      data.onRename?.(id, editName.trim())
    }
    setIsEditing(false)
  }, [editName, data.name, data.onRename, id])

  const handleCancelEdit = useCallback(() => {
    setEditName(data.name)
    setIsEditing(false)
  }, [data.name])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveName()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelEdit()
    }
  }, [handleSaveName, handleCancelEdit])

  const handleToggleCollapse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    data.onToggleCollapse?.(id)
  }, [data.onToggleCollapse, id])

  return (
    <div
      className="w-full h-full rounded-xl border-2 transition-all relative"
      style={{
        backgroundColor: colorInfo.bg,
        borderColor: selected ? colorInfo.value : colorInfo.border,
        boxShadow: selected ? `0 0 0 2px ${colorInfo.value}20` : 'none',
      }}
    >
      <div
        className="flex items-center justify-between px-3 h-8 cursor-move select-none"
        style={{
          backgroundColor: colorInfo.value + '20',
          borderBottom: `1px solid ${colorInfo.border}`,
          borderRadius: '10px 10px 0 0',
        }}
        onDoubleClick={handleDoubleClick}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={handleToggleCollapse}
            className="flex-shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors"
            style={{ color: colorInfo.value }}
          >
            {data.collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {isEditing ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                ref={inputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSaveName}
                className="flex-1 text-sm font-medium bg-white/80 text-foreground px-2 py-0.5 rounded outline-none border border-primary/30 min-w-0"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => { e.stopPropagation(); handleSaveName() }}
                className="flex-shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors text-green-500"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleCancelEdit() }}
                className="flex-shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors text-destructive"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <span
              className="text-sm font-medium truncate"
              style={{ color: colorInfo.value }}
            >
              {data.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: colorInfo.value + '20',
              color: colorInfo.value,
            }}
          >
            {data.nodeCount} 节点
          </span>
          {!isEditing && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDoubleClick(e) }}
              className="p-0.5 rounded hover:bg-white/20 transition-colors opacity-0 group-hover:opacity-100"
              style={{ color: colorInfo.value }}
              title="重命名"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {!data.collapsed && (
        <div className="w-full" style={{ height: 'calc(100% - 32px)' }} />
      )}
    </div>
  )
}

export const GroupNode = memo(GroupNodeComponent, areNodesEqual as any)

'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Pencil, X } from 'lucide-react'
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
      className="w-full h-full rounded-[2px] border-2 transition-all relative overflow-hidden
        clip-path-polygon-[0_0,calc(100%-16px)_0,100%_16px,100%_100%,0_100%]"
      style={{
        backgroundColor: colorInfo.bg,
        borderColor: selected ? colorInfo.value : colorInfo.border,
        boxShadow: selected
          ? `6px 6px 0 ${colorInfo.value}35`
          : `4px 4px 0 ${colorInfo.value}18`,
      }}
    >
      {/* 半调网点装饰 - 左下密集区 */}
      <div
        className="absolute bottom-2 left-2 w-10 h-10 opacity-25 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(${colorInfo.value} 1px, transparent 1px)`,
          backgroundSize: '5px 5px',
        }}
      />
      {/* 订书钉装饰 - 左上 */}
      <div className="absolute top-0 left-4 w-5 h-1.5 bg-slate-400/60 rounded-b-[1px] z-10 shadow-[0_1px_0_rgba(0,0,0,0.2)]" />
      <div className="absolute top-0 right-10 w-5 h-1.5 bg-slate-400/60 rounded-b-[1px] z-10 shadow-[0_1px_0_rgba(0,0,0,0.2)]" />

      <div
        className="flex items-center justify-between px-3 h-8 cursor-move select-none"
        style={{
          backgroundColor: colorInfo.value + '22',
          borderBottom: `1.5px solid ${colorInfo.border}`,
          borderRadius: '2px 2px 0 0',
        }}
        onDoubleClick={handleDoubleClick}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={handleToggleCollapse}
            className="flex-shrink-0 p-0.5 rounded-[2px] hover:bg-white/25 transition-colors"
            style={{ color: colorInfo.value }}
          >
            {data.collapsed ? (
              <ChevronRight className="w-4 h-4" strokeWidth={2.4} />
            ) : (
              <ChevronDown className="w-4 h-4" strokeWidth={2.4} />
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
                className="flex-1 text-sm font-medium bg-card text-foreground px-2 py-0.5 rounded-[2px] outline-none border min-w-0 shadow-[1px_1px_0_rgba(0,0,0,0.05)]"
                style={{ borderColor: colorInfo.value + '55' }}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => { e.stopPropagation(); handleSaveName() }}
                className="flex-shrink-0 p-0.5 rounded-[2px] hover:bg-white/25 transition-colors text-gold-500"
              >
                <Check className="w-3.5 h-3.5" strokeWidth={2.6} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleCancelEdit() }}
                className="flex-shrink-0 p-0.5 rounded-[2px] hover:bg-white/25 transition-colors text-p5-red"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2.6} />
              </button>
            </div>
          ) : (
            <span
              className="text-sm font-semibold truncate tracking-wide"
              style={{ color: colorInfo.value }}
            >
              {data.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className="text-[11px] font-bold px-2 py-0.5 rounded-[1px] border tracking-tight"
            style={{
              backgroundColor: colorInfo.value + '20',
              color: colorInfo.value,
              borderColor: colorInfo.value + '40',
              boxShadow: `1px 1px 0 ${colorInfo.value}22`,
            }}
          >
            {data.nodeCount} 节点
          </span>
          {!isEditing && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDoubleClick(e) }}
              className="p-0.5 rounded-[2px] hover:bg-white/25 transition-colors opacity-60 hover:opacity-100"
              style={{ color: colorInfo.value }}
              title="重命名"
            >
              <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {!data.collapsed && (
        <div className="w-full relative" style={{ height: 'calc(100% - 32px)' }}>
          {/* 右下胶带装饰 */}
          <div
            className="absolute bottom-2 right-2 w-10 h-4 rotate-[-6deg] opacity-50"
            style={{
              backgroundColor: colorInfo.value + '30',
            }}
          />
        </div>
      )}
    </div>
  )
}

export const GroupNode = memo(GroupNodeComponent, areNodesEqual as any)

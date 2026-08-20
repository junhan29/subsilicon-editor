'use client'

import { memo, useEffect, useState } from 'react'
import { Handle, type NodeProps, Position } from '@xyflow/react'
import { Percent, Plus, Shuffle, Trash2 } from 'lucide-react'
import { areNodesEqual } from '@editor/lib/utils'

interface RandomOption {
  id: string
  label: string
  weight: number
  targetId?: string
}

type RandomNodeData = {
  label?: string
  options?: RandomOption[]
}

interface RandomNodeProps extends NodeProps {
  onUpdateNode?: (nodeId: string, data: { options?: RandomOption[] }) => void
}

function RandomNodeComponent({ id, data, selected, onUpdateNode }: RandomNodeProps) {
  const d = data as unknown as RandomNodeData
  const [options, setOptions] = useState<RandomOption[]>(
    d.options || [
      { id: '1', label: '选项 A', weight: 50 },
      { id: '2', label: '选项 B', weight: 50 },
    ]
  )

  useEffect(() => {
    if (d.options && JSON.stringify(d.options) !== JSON.stringify(options)) {
      setOptions(d.options)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.options])

  const totalWeight = options.reduce((sum, opt) => sum + opt.weight, 0)

  const syncToData = (newOptions: RandomOption[]) => {
    setOptions(newOptions)
    if (onUpdateNode) {
      // 走受控更新：入历史栈 + 触发 graph 重算，避免原地 mutation
      // 导致保存时读到旧 options
      onUpdateNode(id, { options: newOptions })
    } else {
      const currentData = data as Record<string, unknown>
      currentData.options = newOptions
    }
  }

  const addOption = () => {
    const newId = Date.now().toString()
    syncToData([
      ...options,
      { id: newId, label: `选项 ${String.fromCharCode(65 + options.length)}`, weight: Math.floor(100 / (options.length + 1)) },
    ])
  }

  const removeOption = (id: string) => {
    if (options.length <= 2) return
    syncToData(options.filter((opt) => opt.id !== id))
  }

  const updateOption = (id: string, field: keyof RandomOption, value: string | number) => {
    syncToData(options.map((opt) => (opt.id === id ? { ...opt, [field]: value } : opt)))
  }

  return (
    <div className={`
      relative bg-card px-3 py-2.5 min-w-[240px] rounded-[2px] border-2
      clip-path-polygon-[0_0,calc(100%-12px)_0,100%_12px,100%_100%,0_100%]
      ${selected
        ? 'border-cyber-cyan-400 shadow-[6px_6px_0_hsl(var(--cyber-cyan)/0.28)]'
        : 'border-border shadow-[4px_4px_0_hsl(var(--cyber-cyan)/0.18)]'
      }
    `}>
      {/* 骰子半调装饰 */}
      <div className="absolute -top-2 -right-2 w-5 h-5 rounded-[1px] bg-cyber-cyan-400 rotate-12 flex items-center justify-center shadow-[2px_2px_0_hsl(var(--cyber-cyan)/0.3)] z-10">
        <span className="text-[8px] font-black text-white">⚅</span>
      </div>
      <div className="absolute -top-1 left-6 w-1.5 h-1.5 rounded-full bg-cyber-cyan-400/60" />
      <div className="absolute -top-1 left-9 w-1.5 h-1.5 rounded-full bg-cyber-cyan-400/40" />

      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-white !border-2 !border-cyber-cyan-400 !-top-2 !transition-all hover:!scale-125"
      />

      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-8 h-8 rounded-[2px] bg-cyber-cyan-400/15 border border-cyber-cyan-400/30 flex items-center justify-center shadow-[2px_2px_0_hsl(var(--cyber-cyan)/0.15)]">
          <Shuffle className="w-4 h-4 text-cyber-cyan-400" />
        </div>
        <span className="text-xs font-bold text-cyber-cyan-400 tracking-wider uppercase">
          随机节点
        </span>
      </div>

      <div className="space-y-1.5">
        {options.map((opt, index) => (
          <div key={opt.id} className="flex items-center gap-1.5 bg-cyber-cyan-400/8 rounded-[2px] px-2 py-1 border border-cyber-cyan-400/15 shadow-[2px_2px_0_hsl(var(--cyber-cyan)/0.1)]">
            <input
              type="text"
              value={opt.label}
              onChange={(e) => updateOption(opt.id, 'label', e.target.value)}
              className="flex-1 bg-transparent border-none text-sm text-foreground placeholder:text-cyber-cyan-300/50 focus:outline-none"
              placeholder={`选项 ${String.fromCharCode(65 + index)}`}
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={opt.weight}
                onChange={(e) => updateOption(opt.id, 'weight', parseInt(e.target.value) || 0)}
                className="w-12 bg-card border border-border rounded-[2px] px-1.5 py-0.5 text-xs text-foreground text-right focus:outline-none focus:border-cyber-cyan-400"
                min="0"
                max="100"
              />
              <Percent className="w-3 h-3 text-cyber-cyan-400/70" />
            </div>
            {opt.targetId ? (
              <span className="text-[10px] text-cyber-cyan-300/70 truncate max-w-[50px] font-mono">
                →{opt.targetId.slice(0, 4)}
              </span>
            ) : (
              <span className="text-[10px] text-cyber-cyan-300/50">∅</span>
            )}
            <button
              onClick={() => removeOption(opt.id)}
              disabled={options.length <= 2}
              className={`p-0.5 rounded-[2px] transition-colors ${options.length <= 2 ? 'text-cyber-cyan-300/30 cursor-not-allowed' : 'text-cyber-cyan-400/70 hover:text-p5-red hover:bg-p5-red/15'}`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addOption}
        className="w-full mt-2 flex items-center justify-center gap-1 py-1.5 bg-cyber-cyan-400/8 hover:bg-cyber-cyan-400/15 border border-dashed border-cyber-cyan-400/30 rounded-[2px] text-xs text-cyber-cyan-400 transition-colors shadow-[2px_2px_0_hsl(var(--cyber-cyan)/0.08)]"
      >
        <Plus className="w-3 h-3" />
        添加选项
      </button>

      <div className="mt-2 flex items-center justify-between text-[10px] text-cyber-cyan-300/70">
        <span className="tracking-wide">总计权重</span>
        <span className="font-bold text-cyber-cyan-400 bg-cyber-cyan-400/10 px-1.5 rounded-[2px]">{totalWeight}%</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-cyber-cyan-400 !border-2 !border-white !-bottom-2 !transition-all hover:!scale-125"
      />
    </div>
  )
}

export const RandomNode = memo(RandomNodeComponent)
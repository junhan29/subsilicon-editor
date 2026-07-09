'use client'

import { memo, useState, useEffect } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Shuffle, Plus, Trash2, Percent } from 'lucide-react'
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

function RandomNodeComponent({ data, selected }: NodeProps) {
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
    const currentData = data as Record<string, unknown>
    currentData.options = newOptions
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
      relative bg-gradient-to-br from-cyan-500/20 to-blue-500/20
      border-2 rounded-xl px-4 py-3 min-w-[240px]
      ${selected ? 'border-cyan-400 shadow-lg shadow-cyan-500/30' : 'border-cyan-500/50'}
    `}>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-white !border-2 !border-cyan-400 !-top-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-cyan-400/30"
      />

      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/30 flex items-center justify-center">
          <Shuffle className="w-4 h-4 text-cyan-400" />
        </div>
        <span className="text-xs font-medium text-cyan-400">
          随机节点
        </span>
      </div>

      <div className="space-y-2">
        {options.map((opt, index) => (
          <div key={opt.id} className="flex items-center gap-2 bg-black/30 rounded px-2 py-1.5">
            <input
              type="text"
              value={opt.label}
              onChange={(e) => updateOption(opt.id, 'label', e.target.value)}
              className="flex-1 bg-transparent border-none text-sm text-white placeholder:text-cyan-300/50 focus:outline-none"
              placeholder={`选项 ${String.fromCharCode(65 + index)}`}
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={opt.weight}
                onChange={(e) => updateOption(opt.id, 'weight', parseInt(e.target.value) || 0)}
                className="w-12 bg-black/30 border border-cyan-500/30 rounded px-1.5 py-0.5 text-xs text-cyan-200 text-right focus:outline-none focus:border-cyan-400"
                min="0"
                max="100"
              />
              <Percent className="w-3 h-3 text-cyan-400/70" />
            </div>
            {opt.targetId ? (
              <span className="text-[10px] text-cyan-300/70 truncate max-w-[60px]">
                → {opt.targetId.slice(0, 6)}
              </span>
            ) : (
              <span className="text-[10px] text-cyan-300/50">未连接</span>
            )}
            <button
              onClick={() => removeOption(opt.id)}
              disabled={options.length <= 2}
              className={`p-0.5 rounded transition-colors ${options.length <= 2 ? 'text-cyan-300/30 cursor-not-allowed' : 'text-cyan-400/70 hover:text-red-400 hover:bg-red-500/20'}`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addOption}
        className="w-full mt-2 flex items-center justify-center gap-1 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-dashed border-cyan-500/30 rounded text-xs text-cyan-400 transition-colors"
      >
        <Plus className="w-3 h-3" />
        添加选项
      </button>

      <div className="mt-2 flex items-center justify-between text-[10px] text-cyan-300/70">
        <span>总计权重</span>
        <span className="font-medium text-cyan-400">{totalWeight}%</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-cyan-400 !border-2 !border-white !-bottom-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-cyan-400/30"
      />
    </div>
  )
}

export const RandomNode = memo(RandomNodeComponent)
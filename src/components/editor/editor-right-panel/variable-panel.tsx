'use client'

import { useState, useCallback } from 'react'
import { Plus, X, ChevronDown, ChevronRight, Trash2, Edit3, Check, BarChart3 } from 'lucide-react'
import type { StoryVariable } from '@editor/types/editor'

interface VariablePanelProps {
  variables?: StoryVariable[]
  onUpdateVariables?: (variables: StoryVariable[]) => void
}

type VariableType = 'string' | 'number' | 'boolean'
type VariableScope = 'story' | 'global' | 'temp'

// 扩展的变量类型（兼容现有 StoryVariable）
interface ExtendedVariable extends StoryVariable {
  id: string
  scope?: VariableScope
  isPersistent?: boolean
  min?: number
  max?: number
  description?: string
  category?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  '角色属性': '#ec4899',
  '剧情进度': '#3b82f6',
  '系统': '#6b7280',
  '自定义': '#8b5cf6',
}

export function VariablePanel({ variables = [], onUpdateVariables }: VariablePanelProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    '角色属性': true,
    '剧情进度': true,
    '系统': false,
  })

  // 新建变量表单状态
  const [newVarName, setNewVarName] = useState('')
  const [newVarType, setNewVarType] = useState<VariableType>('string')
  const [newVarInitial, setNewVarInitial] = useState('')
  const [newVarCategory, setNewVarCategory] = useState('剧情进度')

  // 分类变量
  const categorizedVars = variables.reduce((acc, v) => {
    const ext = v as ExtendedVariable
    const cat = ext.category || '系统'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push({ ...ext, id: ext.name }) // 使用 name 作为 id
    return acc
  }, {} as Record<string, ExtendedVariable[]>)

  const handleAddVariable = useCallback(() => {
    if (!newVarName.trim()) return

    let initialValue: string | number | boolean = ''
    switch (newVarType) {
      case 'number':
        initialValue = parseFloat(newVarInitial) || 0
        break
      case 'boolean':
        initialValue = newVarInitial === 'true'
        break
      default:
        initialValue = newVarInitial
    }

    // 检查是否已存在同名变量
    if (variables.some(v => v.name === newVarName.trim())) {
      return
    }

    const newVar: StoryVariable = {
      name: newVarName.trim(),
      type: newVarType,
      initialValue,
    }

    onUpdateVariables?.([...variables, newVar])
    setNewVarName('')
    setNewVarInitial('')
    setNewVarType('string')
    setShowAddForm(false)
  }, [newVarName, newVarType, newVarInitial, newVarCategory, variables, onUpdateVariables])

  const handleDeleteVariable = useCallback((name: string) => {
    onUpdateVariables?.(variables.filter((v) => v.name !== name))
  }, [variables, onUpdateVariables])

  const handleUpdateVariable = useCallback((name: string, updates: Partial<ExtendedVariable>) => {
    onUpdateVariables?.(
      variables.map((v) =>
        v.name === name ? { ...v, ...updates } : v
      )
    )
    setEditingId(null)
  }, [variables, onUpdateVariables])

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  const renderVariableValue = (v: ExtendedVariable) => {
    const value = (v as any).currentValue ?? v.initialValue
    switch (v.type) {
      case 'boolean':
        return (
          <span className={`px-1.5 py-0.5 rounded text-[10px] ${value ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {value ? '是' : '否'}
          </span>
        )
      case 'number':
        return <span className="text-cyan-400 font-mono">{String(value)}</span>
      default:
        return <span className="text-slate-300 truncate max-w-[120px]">{String(value)}</span>
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">变量管理</h3>
          <span className="text-xs text-slate-500">({variables.length})</span>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-md transition-colors"
        >
          <Plus className="w-3 h-3" />
          新建
        </button>
      </div>

      {/* 添加变量表单 */}
      {showAddForm && (
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white">添加新变量</span>
            <button onClick={() => setShowAddForm(false)} className="text-slate-500 hover:text-slate-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">变量名</label>
              <input
                type="text"
                value={newVarName}
                onChange={(e) => setNewVarName(e.target.value)}
                placeholder="例如：好感度、金币数量"
                className="w-full px-2 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-md text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 block mb-1">类型</label>
                <select
                  value={newVarType}
                  onChange={(e) => setNewVarType(e.target.value as VariableType)}
                  className="w-full px-2 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="string">字符串</option>
                  <option value="number">数字</option>
                  <option value="boolean">布尔值</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 block mb-1">分类</label>
                <select
                  value={newVarCategory}
                  onChange={(e) => setNewVarCategory(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="角色属性">角色属性</option>
                  <option value="剧情进度">剧情进度</option>
                  <option value="系统">系统</option>
                  <option value="自定义">自定义</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 block mb-1">
                初始值
                {newVarType === 'boolean' && <span className="text-slate-600 ml-1">（true/false）</span>}
              </label>
              <input
                type={newVarType === 'number' ? 'number' : 'text'}
                value={newVarInitial}
                onChange={(e) => setNewVarInitial(e.target.value)}
                placeholder={newVarType === 'boolean' ? 'true 或 false' : newVarType === 'number' ? '0' : '初始值'}
                className="w-full px-2 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-md text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              onClick={handleAddVariable}
              disabled={!newVarName.trim()}
              className="w-full py-1.5 text-xs bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-md transition-colors"
            >
              添加变量
            </button>
          </div>
        </div>
      )}

      {/* 预设快捷变量 */}
      {variables.length === 0 && !showAddForm && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 text-center mb-3">快速添加常用变量</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { name: '好感度', type: 'number', category: '角色属性', initial: '0' },
              { name: '金币', type: 'number', category: '系统', initial: '100' },
              { name: '章节', type: 'number', category: '剧情进度', initial: '1' },
              { name: '已解锁', type: 'boolean', category: '系统', initial: 'false' },
            ].map((preset) => (
              <button
                key={preset.name}
                onClick={() => {
                  setNewVarName(preset.name)
                  setNewVarType(preset.type as VariableType)
                  setNewVarInitial(preset.initial)
                  setNewVarCategory(preset.category)
                  setShowAddForm(true)
                }}
                className="px-2 py-1 text-[10px] rounded-md border border-slate-700 bg-slate-800/50 hover:bg-slate-700 hover:border-cyan-500/50 text-slate-300 transition-colors"
              >
                + {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 变量列表 */}
      <div className="space-y-2">
        {Object.entries(categorizedVars).map(([category, vars]) => (
          <div key={category}>
            {/* 分类标题 */}
            <button
              onClick={() => toggleCategory(category)}
              className="flex items-center gap-1.5 w-full py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              {expandedCategories[category] ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[category] || '#6b7280' }}
              />
              <span>{category}</span>
              <span className="text-slate-600">({vars.length})</span>
            </button>

            {/* 分类下的变量 */}
            {expandedCategories[category] && (
              <div className="ml-3 space-y-1">
                {vars.map((v) => (
                  <div
                    key={v.id}
                    className="group flex items-center gap-2 p-2 bg-slate-800/30 hover:bg-slate-800/60 rounded-md border border-transparent hover:border-slate-700 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white truncate">{v.name}</span>
                        <span className="text-[10px] text-slate-600">
                          {v.type === 'string' ? '字' : v.type === 'number' ? '数' : '布尔'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-slate-600">当前值:</span>
                        {renderVariableValue(v)}
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditingId(editingId === v.id ? null : v.id)}
                        className="p-1 text-slate-500 hover:text-cyan-400 transition-colors"
                        title="编辑"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteVariable(v.id)}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 内置变量说明 */}
      {variables.length > 0 && (
        <div className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-slate-800">
          <p className="text-[10px] text-slate-600 leading-relaxed">
            <span className="text-slate-500 font-medium">提示：</span>
            变量可以在条件节点和选择节点中使用。例如：
            <code className="text-cyan-500 ml-1">好感度 {'>='} 60</code>
            或
            <code className="text-cyan-500 ml-1">金币 {'>'} 100</code>
          </p>
        </div>
      )}
    </div>
  )
}

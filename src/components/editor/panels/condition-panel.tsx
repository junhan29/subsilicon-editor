'use client'

import { useState, useEffect, useCallback } from 'react'
import { Label } from '@editor/components/ui/label'
import { Input } from '@editor/components/ui/input'
import { Code2, Eye } from 'lucide-react'
import type { BasePanelProps } from './shared-props'
import type { ConditionGroup } from '@editor/types/editor'
import { VisualConditionEditor } from '../visual-condition-editor'
import { buildExpression, parseExpression, createEmptyGroup, createEmptyClause } from '@editor/lib/condition-builder'
import { useDebouncedState } from '@editor/lib/use-debounced-state'

type EditorMode = 'visual' | 'manual'

export function ConditionPanel({ node, variables = [], onUpdateNode }: BasePanelProps) {
  const { data, id } = node
  const expression = (data as any).expression || ''
  const conditionGroups = (data as any).conditionGroups as ConditionGroup[] | undefined

  const [mode, setMode] = useState<EditorMode>('visual')
  const [localGroups, setLocalGroups] = useState<ConditionGroup[]>([])

  const [manualExpression, setManualExpression] = useDebouncedState(
    expression,
    300,
    (value) => {
      onUpdateNode(id, { ...data, expression: value })
    }
  )

  useEffect(() => {
    if (conditionGroups && conditionGroups.length > 0) {
      setLocalGroups(conditionGroups)
      return
    }

    if (expression && variables.length > 0) {
      const parsed = parseExpression(expression, variables)
      if (parsed.length > 0) {
        setLocalGroups(parsed)
        return
      }
    }

    if (variables.length > 0) {
      const firstVar = variables[0]
      const group = createEmptyGroup()
      group.clauses.push(createEmptyClause(firstVar.name, firstVar.type))
      setLocalGroups([group])
    } else {
      setLocalGroups([createEmptyGroup()])
    }
  }, [node.id, expression, conditionGroups, variables])

  const handleGroupsChange = useCallback(
    (groups: ConditionGroup[]) => {
      setLocalGroups(groups)
      const expr = buildExpression(groups)
      onUpdateNode(id, {
        ...data,
        expression: expr,
        conditionGroups: groups,
      })
    },
    [id, data, onUpdateNode]
  )

  const handleSwitchToVisual = useCallback(() => {
    if (manualExpression && variables.length > 0) {
      const parsed = parseExpression(manualExpression, variables)
      if (parsed.length > 0) {
        setLocalGroups(parsed)
      }
    }
    setMode('visual')
  }, [manualExpression, variables])

  const handleSwitchToManual = useCallback(() => {
    setManualExpression(expression)
    setMode('manual')
  }, [expression, setManualExpression])

  return (
    <>
      <div className="flex items-center justify-between">
        <Label className="text-xs">条件表达式</Label>
        <div className="flex rounded-md overflow-hidden border border-border">
          <button
            onClick={() => mode === 'manual' && handleSwitchToVisual()}
            className={`px-2 py-0.5 text-[10px] font-medium transition-colors flex items-center gap-1 ${
              mode === 'visual'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            <Eye className="w-3 h-3" />
            可视化
          </button>
          <button
            onClick={() => mode === 'visual' && handleSwitchToManual()}
            className={`px-2 py-0.5 text-[10px] font-medium transition-colors flex items-center gap-1 ${
              mode === 'manual'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            <Code2 className="w-3 h-3" />
            手动
          </button>
        </div>
      </div>

      {variables.length === 0 && (
        <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-2">
          <p className="text-[10px] text-amber-500">
            请先在变量管理中定义变量，才能使用可视化条件编辑
          </p>
        </div>
      )}

      {mode === 'visual' ? (
        <VisualConditionEditor
          groups={localGroups}
          variables={variables}
          onChange={handleGroupsChange}
        />
      ) : (
        <div className="space-y-2">
          <Input
            value={manualExpression}
            onChange={(e) => setManualExpression(e.target.value)}
            onBlur={() => {
              onUpdateNode(id, { ...data, expression: manualExpression })
            }}
            placeholder="例如: score >= 60"
            className="text-sm font-mono"
          />
          <p className="text-[10px] text-muted-foreground">
            支持变量比较，如 varName {'>'} 10、varName === 'value' 等
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label className="text-xs">真分支标签</Label>
          <Input
            value={(data as any).trueLabel || ''}
            onChange={(e) => onUpdateNode(id, { ...data, trueLabel: e.target.value })}
            placeholder="是"
            className="text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">假分支标签</Label>
          <Input
            value={(data as any).falseLabel || ''}
            onChange={(e) => onUpdateNode(id, { ...data, falseLabel: e.target.value })}
            placeholder="否"
            className="text-sm"
          />
        </div>
      </div>
    </>
  )
}

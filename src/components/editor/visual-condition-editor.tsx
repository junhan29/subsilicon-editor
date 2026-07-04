'use client'

import { useCallback } from 'react'
import { Trash2, Plus } from 'lucide-react'
import type { ConditionGroup, ConditionClause, StoryVariable } from '@editor/types/editor'
import { buildExpression, createEmptyGroup, createEmptyClause } from '@editor/lib/condition-builder'
import { Label } from '@editor/components/ui/label'

interface VisualConditionEditorProps {
  groups: ConditionGroup[]
  variables: StoryVariable[]
  onChange: (groups: ConditionGroup[]) => void
}

const NUMBER_OPERATORS = [
  { value: '==', label: '等于 (==)' },
  { value: '!=', label: '不等于 (!=)' },
  { value: '>', label: '大于 (>)' },
  { value: '>=', label: '大于等于 (>=)' },
  { value: '<', label: '小于 (<)' },
  { value: '<=', label: '小于等于 (<=)' },
] as const

const STRING_OPERATORS = [
  { value: '==', label: '等于 (==)' },
  { value: '!=', label: '不等于 (!=)' },
  { value: 'contains', label: '包含' },
  { value: 'startsWith', label: '开头是' },
  { value: 'endsWith', label: '结尾是' },
] as const

const BOOLEAN_OPERATORS = [
  { value: '==', label: '等于 (==)' },
  { value: '!=', label: '不等于 (!=)' },
] as const

function getOperatorsForType(type: 'string' | 'number' | 'boolean') {
  if (type === 'number') return NUMBER_OPERATORS
  if (type === 'boolean') return BOOLEAN_OPERATORS
  return STRING_OPERATORS
}

export function VisualConditionEditor({ groups, variables, onChange }: VisualConditionEditorProps) {
  const getVariableType = useCallback(
    (varName: string): 'string' | 'number' | 'boolean' => {
      const v = variables.find((v) => v.name === varName)
      return v?.type || 'string'
    },
    [variables]
  )

  const handleAddGroup = useCallback(() => {
    const newGroup = createEmptyGroup()
    if (variables.length > 0) {
      const firstVar = variables[0]
      newGroup.clauses.push(createEmptyClause(firstVar.name, firstVar.type))
    }
    onChange([...groups, newGroup])
  }, [groups, variables, onChange])

  const handleDeleteGroup = useCallback(
    (groupId: string) => {
      onChange(groups.filter((g) => g.id !== groupId))
    },
    [groups, onChange]
  )

  const handleToggleGroupLogic = useCallback(
    (groupId: string) => {
      onChange(
        groups.map((g) =>
          g.id === groupId ? { ...g, logic: g.logic === 'AND' ? 'OR' : 'AND' } : g
        )
      )
    },
    [groups, onChange]
  )

  const handleAddClause = useCallback(
    (groupId: string) => {
      onChange(
        groups.map((g) => {
          if (g.id !== groupId) return g
          const firstVar = variables[0]
          const newClause = createEmptyClause(
            firstVar?.name || '',
            firstVar?.type || 'string'
          )
          return { ...g, clauses: [...g.clauses, newClause] }
        })
      )
    },
    [groups, variables, onChange]
  )

  const handleDeleteClause = useCallback(
    (groupId: string, clauseId: string) => {
      onChange(
        groups.map((g) => {
          if (g.id !== groupId) return g
          return { ...g, clauses: g.clauses.filter((c) => c.id !== clauseId) }
        })
      )
    },
    [groups, onChange]
  )

  const handleClauseChange = useCallback(
    (groupId: string, clauseId: string, updates: Partial<ConditionClause>) => {
      onChange(
        groups.map((g) => {
          if (g.id !== groupId) return g
          return {
            ...g,
            clauses: g.clauses.map((c) =>
              c.id === clauseId ? { ...c, ...updates } : c
            ),
          }
        })
      )
    },
    [groups, onChange]
  )

  const handleVariableChange = useCallback(
    (groupId: string, clauseId: string, varName: string) => {
      const varType = getVariableType(varName)
      let newOperator: ConditionClause['operator'] = '=='
      let newValue: string | number | boolean = ''

      if (varType === 'number') {
        newOperator = '>'
        newValue = 0
      } else if (varType === 'boolean') {
        newOperator = '=='
        newValue = true
      } else {
        newOperator = '=='
        newValue = ''
      }

      handleClauseChange(groupId, clauseId, {
        variable: varName,
        operator: newOperator,
        value: newValue,
        valueType: varType,
      })
    },
    [getVariableType, handleClauseChange]
  )

  const previewExpression = buildExpression(groups)

  if (groups.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">暂无条件组</p>
          <button
            onClick={handleAddGroup}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:brightness-110 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            添加条件组
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {groups.map((group, groupIndex) => (
        <div
          key={group.id}
          className="rounded-lg border border-border bg-card/50 p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                条件组 {groupIndex + 1}
              </span>
              <div className="flex rounded-md overflow-hidden border border-border">
                <button
                  onClick={() => handleToggleGroupLogic(group.id)}
                  className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    group.logic === 'AND'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  AND
                </button>
                <button
                  onClick={() => handleToggleGroupLogic(group.id)}
                  className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    group.logic === 'OR'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  OR
                </button>
              </div>
            </div>
            <button
              onClick={() => handleDeleteGroup(group.id)}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="删除条件组"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {group.clauses.map((clause, clauseIndex) => {
              const varType = getVariableType(clause.variable)
              const operators = getOperatorsForType(varType)

              return (
                <div key={clause.id} className="flex items-center gap-1.5">
                  {clauseIndex > 0 && (
                    <span className="text-[10px] text-muted-foreground font-medium w-8 text-center">
                      {group.logic}
                    </span>
                  )}
                  {clauseIndex === 0 && <div className="w-8" />}

                  <select
                    value={clause.variable}
                    onChange={(e) =>
                      handleVariableChange(group.id, clause.id, e.target.value)
                    }
                    className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-xs min-w-0"
                  >
                    <option value="">选择变量</option>
                    {variables.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={clause.operator}
                    onChange={(e) =>
                      handleClauseChange(group.id, clause.id, {
                        operator: e.target.value as ConditionClause['operator'],
                      })
                    }
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs w-24 shrink-0"
                  >
                    {operators.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>

                  {varType === 'boolean' ? (
                    <select
                      value={String(clause.value)}
                      onChange={(e) =>
                        handleClauseChange(group.id, clause.id, {
                          value: e.target.value === 'true',
                        })
                      }
                      className="h-7 rounded-md border border-input bg-background px-2 text-xs w-20 shrink-0"
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : varType === 'number' ? (
                    <input
                      type="number"
                      value={clause.value as number}
                      onChange={(e) =>
                        handleClauseChange(group.id, clause.id, {
                          value: Number(e.target.value),
                        })
                      }
                      className="h-7 rounded-md border border-input bg-background px-2 text-xs w-20 shrink-0"
                    />
                  ) : (
                    <input
                      type="text"
                      value={clause.value as string}
                      onChange={(e) =>
                        handleClauseChange(group.id, clause.id, {
                          value: e.target.value,
                        })
                      }
                      placeholder="值"
                      className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-xs min-w-0"
                    />
                  )}

                  <button
                    onClick={() => handleDeleteClause(group.id, clause.id)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    title="删除条件"
                    disabled={group.clauses.length <= 1}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => handleAddClause(group.id)}
            className="w-full flex items-center justify-center gap-1 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors"
          >
            <Plus className="w-3 h-3" />
            添加条件
          </button>
        </div>
      ))}

      {groups.length > 0 && (
        <button
          onClick={handleAddGroup}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg border border-dashed border-border transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          添加条件组
        </button>
      )}

      {previewExpression && (
        <div className="mt-3 pt-3 border-t border-border">
          <Label className="text-[10px] text-muted-foreground mb-1.5 block">
            表达式预览
          </Label>
          <div className="rounded-md bg-muted/50 border border-border p-2 font-mono text-[11px] break-all">
            {previewExpression}
          </div>
        </div>
      )}
    </div>
  )
}

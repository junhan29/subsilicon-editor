'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Label } from '@editor/components/ui/label'
import { Input } from '@editor/components/ui/input'
import { Button } from '@editor/components/ui/button'
import { Plus, X } from 'lucide-react'
import type { BasePanelProps } from './shared-props'
import { AiAssistButton } from '../ai-assist-button'

export function ChoicePanel({ node, variables, onUpdateNode }: BasePanelProps) {
  const { data, id } = node
  const [newOptionText, setNewOptionText] = useState('')

  const storeRef = useRef(data)
  storeRef.current = data

  const commitOptions = useCallback((options: any[]) => {
    onUpdateNode(id, { ...storeRef.current, options })
  }, [id, onUpdateNode])

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">选项列表</Label>
          <AiAssistButton
            mode="generate"
            context={`当前选项：${((data as any).options || []).map((o: any) => o.text).join('、') || '暂无'}\n请生成2-3个适合互动叙事的选项。`}
            onResult={(result) => {
              const lines = result.split(/\n/).filter(l => l.trim()).map(l => l.replace(/^[-\d.\s]+/, '').trim())
              const options = (data as any).options || []
              const newOptions = [
                ...options,
                ...lines.filter(l => l).map((text: string) => ({ id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text }))
              ]
              commitOptions(newOptions)
            }}
            size="sm"
            label="AI生成选项"
          />
        </div>
        <div className="space-y-2.5">
          {((data as any).options || []).map((opt: any, i: number) => (
            <OptionItem
              key={opt.id || i}
              opt={opt}
              index={i}
              options={(data as any).options || []}
              variables={variables}
              onCommit={commitOptions}
              onDelete={(index) => {
                const newOptions = (storeRef.current as any).options.filter((_: any, idx: number) => idx !== index)
                commitOptions(newOptions)
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Input
            value={newOptionText}
            onChange={(e) => setNewOptionText(e.target.value)}
            placeholder="新选项文字"
            className="text-sm h-8"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newOptionText.trim()) {
                const options = (data as any).options || []
                commitOptions([...options, { id: `opt-${Date.now()}`, text: newOptionText.trim() }])
                setNewOptionText('')
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2"
            onClick={() => {
              if (!newOptionText.trim()) return
              const options = (data as any).options || []
              commitOptions([...options, { id: `opt-${Date.now()}`, text: newOptionText.trim() }])
              setNewOptionText('')
            }}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </>
  )
}

function OptionItem({
  opt,
  index,
  options,
  variables,
  onCommit,
  onDelete,
}: {
  opt: any
  index: number
  options: any[]
  variables: any[] | undefined
  onCommit: (options: any[]) => void
  onDelete: (index: number) => void
}) {
  const [localText, setLocalText] = useState(opt.text)

  useEffect(() => {
    setLocalText(opt.text)
  }, [opt.text])

  const commitText = useCallback(() => {
    const newOptions = [...options]
    newOptions[index] = { ...opt, text: localText }
    onCommit(newOptions)
  }, [options, index, opt, localText, onCommit])

  return (
    <div className="space-y-1.5 p-2 rounded-lg border border-border/60 bg-background/50">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-5 shrink-0">{index + 1}</span>
        <Input
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={commitText}
          className="text-sm h-8 flex-1"
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 shrink-0"
          onClick={() => onDelete(index)}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>

      {variables && variables.length > 0 && (
        <div className="pl-7 space-y-1.5 pt-1 border-t border-border/40">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">变量效果：</span>
            <select
              value={opt.variableEffect?.variableName || ''}
              onChange={(e) => {
                const newOptions = [...options]
                const varName = e.target.value
                if (varName) {
                  const v = variables.find((v: any) => v.name === varName)
                  newOptions[index] = {
                    ...opt,
                    variableEffect: {
                      variableName: varName,
                      operation: 'add' as const,
                      value: v?.type === 'number' ? 1 : (v?.type === 'boolean' ? true : ''),
                    },
                  }
                } else {
                  newOptions[index] = { ...opt, variableEffect: undefined }
                }
                onCommit(newOptions)
              }}
              className="h-6 text-[10px] rounded border border-input bg-background px-1.5 flex-1 min-w-0"
            >
              <option value="">无</option>
              {variables.map((v: any) => (
                <option key={v.name} value={v.name}>{v.name}</option>
              ))}
            </select>
          </div>

          {opt.variableEffect?.variableName && (
            <div className="flex items-center gap-1.5">
              <select
                value={opt.variableEffect.operation || 'add'}
                onChange={(e) => {
                  const newOptions = [...options]
                  newOptions[index] = {
                    ...opt,
                    variableEffect: {
                      ...opt.variableEffect,
                      operation: e.target.value as 'set' | 'add' | 'subtract',
                    },
                  }
                  onCommit(newOptions)
                }}
                className="h-6 text-[10px] rounded border border-input bg-background px-1.5 w-14 shrink-0"
              >
                <option value="set">设为</option>
                <option value="add">+加</option>
                <option value="subtract">-减</option>
              </select>
              <Input
                key={opt.variableEffect.variableName}
                defaultValue={String(opt.variableEffect.value ?? '')}
                onBlur={(e) => {
                  const v = variables.find((v: any) => v.name === opt.variableEffect.variableName)
                  let val: string | number | boolean = e.target.value
                  if (v?.type === 'number') val = Number(e.target.value) || 0
                  if (v?.type === 'boolean') val = e.target.value === 'true'
                  const newOptions = [...options]
                  newOptions[index] = {
                    ...opt,
                    variableEffect: { ...opt.variableEffect, value: val },
                  }
                  onCommit(newOptions)
                }}
                className="h-6 text-[10px] flex-1 min-w-0"
                placeholder="值"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

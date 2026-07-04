'use client'

import { useState, useRef, useEffect } from 'react'
import { Label } from '@editor/components/ui/label'
import { Input } from '@editor/components/ui/input'
import { Button } from '@editor/components/ui/button'
import { Plus, X } from 'lucide-react'
import type { BasePanelProps } from './shared-props'

export function ChoicePanel({ node, variables, onUpdateNode }: BasePanelProps) {
  const { data, id } = node
  const [newOptionText, setNewOptionText] = useState('')
  const debounceTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  useEffect(() => {
    return () => {
      debounceTimerRef.current.forEach((timer) => clearTimeout(timer))
      debounceTimerRef.current.clear()
    }
  }, [])

  const debouncedUpdateOptionText = (index: number, opt: any, text: string) => {
    const key = `text-${index}`
    if (debounceTimerRef.current.has(key)) {
      clearTimeout(debounceTimerRef.current.get(key)!)
    }
    const timer = setTimeout(() => {
      const newOptions = [...(data as any).options]
      newOptions[index] = { ...opt, text }
      onUpdateNode(id, { ...data, options: newOptions })
      debounceTimerRef.current.delete(key)
    }, 300)
    debounceTimerRef.current.set(key, timer)
  }

  const debouncedUpdateVariableValue = (index: number, opt: any, value: string | number | boolean) => {
    const key = `var-val-${index}`
    if (debounceTimerRef.current.has(key)) {
      clearTimeout(debounceTimerRef.current.get(key)!)
    }
    const timer = setTimeout(() => {
      const newOptions = [...(data as any).options]
      newOptions[index] = {
        ...opt,
        variableEffect: { ...opt.variableEffect, value },
      }
      onUpdateNode(id, { ...data, options: newOptions })
      debounceTimerRef.current.delete(key)
    }, 300)
    debounceTimerRef.current.set(key, timer)
  }

  return (
    <>
      <div className="space-y-2">
        <Label className="text-xs">选项列表</Label>
        <div className="space-y-2.5">
          {((data as any).options || []).map((opt: any, i: number) => (
            <div key={opt.id || i} className="space-y-1.5 p-2 rounded-lg border border-border/60 bg-background/50">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}</span>
                <Input
                  value={opt.text}
                  onChange={(e) => debouncedUpdateOptionText(i, opt, e.target.value)}
                  onBlur={() => {
                    const key = `text-${i}`
                    if (debounceTimerRef.current.has(key)) {
                      clearTimeout(debounceTimerRef.current.get(key)!)
                      debounceTimerRef.current.delete(key)
                    }
                    const newOptions = [...(data as any).options]
                    newOptions[i] = { ...opt, text: opt.text }
                    onUpdateNode(id, { ...data, options: newOptions })
                  }}
                  className="text-sm h-8 flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={() => {
                    const newOptions = (data as any).options.filter((_: any, idx: number) => idx !== i)
                    onUpdateNode(id, { ...data, options: newOptions })
                  }}
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
                        const newOptions = [...(data as any).options]
                        const varName = e.target.value
                        if (varName) {
                          const v = variables.find((v) => v.name === varName)
                          newOptions[i] = {
                            ...opt,
                            variableEffect: {
                              variableName: varName,
                              operation: 'add' as const,
                              value: v?.type === 'number' ? 1 : (v?.type === 'boolean' ? true : ''),
                            },
                          }
                        } else {
                          newOptions[i] = { ...opt, variableEffect: undefined }
                        }
                        onUpdateNode(id, { ...data, options: newOptions })
                      }}
                      className="h-6 text-[10px] rounded border border-input bg-background px-1.5 flex-1 min-w-0"
                    >
                      <option value="">无</option>
                      {variables.map((v) => (
                        <option key={v.name} value={v.name}>{v.name}</option>
                      ))}
                    </select>
                  </div>

                  {opt.variableEffect?.variableName && (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={opt.variableEffect.operation || 'add'}
                        onChange={(e) => {
                          const newOptions = [...(data as any).options]
                          newOptions[i] = {
                            ...opt,
                            variableEffect: {
                              ...opt.variableEffect,
                              operation: e.target.value as 'set' | 'add' | 'subtract',
                            },
                          }
                          onUpdateNode(id, { ...data, options: newOptions })
                        }}
                        className="h-6 text-[10px] rounded border border-input bg-background px-1.5 w-14 shrink-0"
                      >
                        <option value="set">设为</option>
                        <option value="add">+加</option>
                        <option value="subtract">-减</option>
                      </select>
                      <Input
                        value={String(opt.variableEffect.value ?? '')}
                        onChange={(e) => {
                          const v = variables.find((v) => v.name === opt.variableEffect.variableName)
                          let val: string | number | boolean = e.target.value
                          if (v?.type === 'number') val = Number(e.target.value) || 0
                          if (v?.type === 'boolean') val = e.target.value === 'true'
                          debouncedUpdateVariableValue(i, opt, val)
                        }}
                        onBlur={() => {
                          const key = `var-val-${i}`
                          if (debounceTimerRef.current.has(key)) {
                            clearTimeout(debounceTimerRef.current.get(key)!)
                            debounceTimerRef.current.delete(key)
                          }
                          const v = variables.find((v) => v.name === opt.variableEffect.variableName)
                          let val: string | number | boolean = opt.variableEffect.value
                          if (v?.type === 'number') val = Number(opt.variableEffect.value) || 0
                          if (v?.type === 'boolean') val = opt.variableEffect.value === 'true'
                          const newOptions = [...(data as any).options]
                          newOptions[i] = {
                            ...opt,
                            variableEffect: { ...opt.variableEffect, value: val },
                          }
                          onUpdateNode(id, { ...data, options: newOptions })
                        }}
                        className="h-6 text-[10px] flex-1 min-w-0"
                        placeholder="值"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
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
                onUpdateNode(id, {
                  ...data,
                  options: [...options, { id: `opt-${Date.now()}`, text: newOptionText.trim() }],
                })
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
              onUpdateNode(id, {
                ...data,
                options: [...options, { id: `opt-${Date.now()}`, text: newOptionText.trim() }],
              })
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

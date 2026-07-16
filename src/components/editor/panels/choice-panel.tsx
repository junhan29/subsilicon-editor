'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Label } from '@editor/components/ui/label'
import { Input } from '@editor/components/ui/input'
import { Button } from '@editor/components/ui/button'
import { Plus, X, Image as ImageIcon, Upload, Layers } from 'lucide-react'
import type { BasePanelProps } from './shared-props'
import { AiAssistButton } from '../ai-assist-button'

const CHOICE_MODES: { value: 'text' | 'image' | 'scene'; label: string; icon: any }[] = [
  { value: 'text', label: '文本选择', icon: null },
  { value: 'image', label: '图片选择', icon: ImageIcon },
  { value: 'scene', label: '场景选择', icon: Layers },
]

const IMAGE_POSITION_OPTIONS: { value: 'top' | 'left' | 'background'; label: string }[] = [
  { value: 'top', label: '上图下文' },
  { value: 'left', label: '左图右文' },
  { value: 'background', label: '背景图' },
]

export function ChoicePanel({ node, variables, scenes, onUpdateNode }: BasePanelProps) {
  const { data, id } = node
  const [newOptionText, setNewOptionText] = useState('')
  const d = data as any
  const choiceMode: 'text' | 'image' | 'scene' = d.choiceMode || 'text'

  const storeRef = useRef(data)
  storeRef.current = data

  const updateData = useCallback((patch: Record<string, unknown>) => {
    onUpdateNode(id, { ...storeRef.current, ...patch })
  }, [id, onUpdateNode])

  const commitOptions = useCallback((options: any[]) => {
    onUpdateNode(id, { ...storeRef.current, options })
  }, [id, onUpdateNode])

  // 仅展示含拼图数据的场景
  const puzzleScenes = (scenes || []).filter((s) => s.puzzleData)

  return (
    <>
      {/* 选择模式 */}
      <div className="space-y-2">
        <Label className="text-xs">选择模式</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {CHOICE_MODES.map((mode) => {
            const Icon = mode.icon
            const isActive = choiceMode === mode.value
            return (
              <button
                key={mode.value}
                onClick={() => updateData({ choiceMode: mode.value })}
                className={`py-1.5 px-2 rounded-md text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${
                  isActive ? 'bg-pink-500 text-white' : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {mode.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 场景选择模式：选择解谜场景 */}
      {choiceMode === 'scene' && (
        <div className="space-y-2">
          <Label className="text-xs">解谜场景</Label>
          {puzzleScenes.length === 0 ? (
            <p className="text-[10px] text-muted-foreground italic">
              暂无可选的解谜场景，请先在场景管理中创建带拼图数据的场景
            </p>
          ) : (
            <select
              value={d.sceneId || ''}
              onChange={(e) => updateData({ sceneId: e.target.value })}
              className="w-full h-8 text-sm rounded-md border border-input bg-background px-2"
            >
              <option value="">— 请选择场景 —</option>
              {puzzleScenes.map((scene) => (
                <option key={scene.id} value={scene.id}>{scene.name}</option>
              ))}
            </select>
          )}
          <p className="text-[10px] text-muted-foreground">
            玩家通过点击场景中的可点击图层进行选择
          </p>
        </div>
      )}

      {/* 选项列表 */}
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
              choiceMode={choiceMode}
              onCommit={commitOptions}
              onDelete={(index) => {
                const newOptions = ((storeRef.current as any).options || []).filter((_: any, idx: number) => idx !== index)
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
  choiceMode,
  onCommit,
  onDelete,
}: {
  opt: any
  index: number
  options: any[]
  variables: any[] | undefined
  choiceMode: 'text' | 'image' | 'scene'
  onCommit: (options: any[]) => void
  onDelete: (index: number) => void
}) {
  const [localText, setLocalText] = useState(opt.text)
  const [localImage, setLocalImage] = useState(opt.image || '')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLocalText(opt.text)
  }, [opt.text])

  useEffect(() => {
    setLocalImage(opt.image || '')
  }, [opt.image])

  const commitText = useCallback(() => {
    const newOptions = [...options]
    newOptions[index] = { ...opt, text: localText }
    onCommit(newOptions)
  }, [options, index, opt, localText, onCommit])

  const commitImage = useCallback((value: string) => {
    const newOptions = [...options]
    newOptions[index] = { ...opt, image: value }
    onCommit(newOptions)
  }, [options, index, opt, onCommit])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setLocalImage(base64)
      commitImage(base64)
    }
    reader.readAsDataURL(file)
    // 清空 input 以便同一文件可重复选择
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

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

      {/* 图片模式：图片URL + 上传 + 位置选择 */}
      {choiceMode === 'image' && (
        <div className="pl-7 space-y-1.5 pt-1 border-t border-border/40">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground shrink-0 w-12">图片</span>
            <Input
              value={localImage}
              onChange={(e) => setLocalImage(e.target.value)}
              onBlur={() => commitImage(localImage)}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text')
                if (pasted && pasted.trim()) {
                  const value = pasted.trim()
                  setLocalImage(value)
                  commitImage(value)
                }
              }}
              placeholder="粘贴或输入图片URL"
              className="h-6 text-[10px] flex-1 min-w-0"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-6 w-6 p-0 shrink-0"
              onClick={() => fileInputRef.current?.click()}
              title="上传图片文件"
            >
              <Upload className="w-3 h-3" />
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground shrink-0 w-12">位置</span>
            <select
              value={opt.imagePosition || 'top'}
              onChange={(e) => {
                const newOptions = [...options]
                newOptions[index] = {
                  ...opt,
                  imagePosition: e.target.value as 'top' | 'left' | 'background',
                }
                onCommit(newOptions)
              }}
              className="h-6 text-[10px] rounded border border-input bg-background px-1.5 flex-1 min-w-0"
            >
              {IMAGE_POSITION_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {localImage && (
            <div className="relative rounded-md overflow-hidden border border-border h-16 bg-muted/30">
              <img src={localImage} alt="预览" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      )}

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

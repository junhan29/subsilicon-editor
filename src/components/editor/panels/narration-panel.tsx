'use client'

import { Label } from '@editor/components/ui/label'
import { Input } from '@editor/components/ui/input'
import { Textarea } from '@editor/components/ui/textarea'
import { Slider } from '@editor/components/ui/slider'
import { Eye } from 'lucide-react'
import type { BasePanelProps } from './shared-props'
import { TEXT_ANIMATION_TYPES } from './shared-props'
import { useDebouncedState } from '@editor/lib/use-debounced-state'

export function NarrationPanel({ node, onUpdateNode }: BasePanelProps) {
  const { data, id } = node

  const [text, setText] = useDebouncedState(
    (data as any).text || '',
    300,
    (value) => onUpdateNode(id, { ...data, text: value })
  )

  return (
    <>
      <div className="space-y-2">
        <Label className="text-xs">旁白文本</Label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const finalValue = text
            onUpdateNode(id, { ...data, text: finalValue })
          }}
          placeholder="输入旁白文本..."
          className="min-h-[80px] resize-none text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label className="text-xs">字号</Label>
          <Input
            type="number"
            value={(data as any).fontSize || 16}
            onChange={(e) => onUpdateNode(id, { ...data, fontSize: Number(e.target.value) })}
            className="text-sm h-8"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">文字颜色</Label>
          <div className="flex gap-1">
            <Input
              type="color"
              value={(data as any).fontColor || '#ffffff'}
              onChange={(e) => onUpdateNode(id, { ...data, fontColor: e.target.value })}
              className="w-8 h-8 p-0.5 rounded-md cursor-pointer"
            />
            <Input
              value={(data as any).fontColor || '#ffffff'}
              onChange={(e) => onUpdateNode(id, { ...data, fontColor: e.target.value })}
              className="text-sm h-8 flex-1"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">文字动画</Label>
        <select
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={(data as any).textAnimation || 'typewriter'}
          onChange={(e) => onUpdateNode(id, { ...data, textAnimation: e.target.value })}
        >
          {TEXT_ANIMATION_TYPES.map((anim) => (
            <option key={anim.value} value={anim.value}>{anim.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">背景色（可选）</Label>
        <div className="flex gap-1">
          <Input
            type="color"
            value={(data as any).backgroundColor || '#000000'}
            onChange={(e) => onUpdateNode(id, { ...data, backgroundColor: e.target.value })}
            className="w-8 h-8 p-0.5 rounded-md cursor-pointer"
          />
          <Input
            value={(data as any).backgroundColor || ''}
            onChange={(e) => onUpdateNode(id, { ...data, backgroundColor: e.target.value })}
            placeholder="留空使用默认背景"
            className="text-sm h-8 flex-1"
          />
        </div>
      </div>

      {/* 预览 UI 定制 */}
      <div className="flex items-center gap-2 pt-1">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Eye className="w-3 h-3" /> 预览样式
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">字号</Label>
          <span className="text-[10px] text-muted-foreground">{(data as any).fontSize || 16}px</span>
        </div>
        <Slider
          value={[(data as any).fontSize || 16]}
          onValueChange={([v]) => onUpdateNode(id, { ...data, fontSize: v })}
          min={12}
          max={32}
          step={1}
        />
      </div>
    </>
  )
}
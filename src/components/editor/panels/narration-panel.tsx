'use client'

import { useState, useCallback } from 'react'
import { Label } from '@editor/components/ui/label'
import { Input } from '@editor/components/ui/input'
import { Textarea } from '@editor/components/ui/textarea'
import { Slider } from '@editor/components/ui/slider'
import { Eye, Sparkles } from 'lucide-react'
import type { BasePanelProps } from './shared-props'
import { TEXT_ANIMATION_TYPES } from './shared-props'
import { useDebouncedState } from '@editor/lib/use-debounced-state'
import { expandScene, type PolishStyle } from '@editor/lib/ai-service'
import { showToast } from '../toast'

export function NarrationPanel({ node, onUpdateNode }: BasePanelProps) {
  const { data, id } = node

  const [text, setText] = useDebouncedState(
    (data as any).text || '',
    300,
    (value) => onUpdateNode(id, { ...data, text: value })
  )
  const [isExpanding, setIsExpanding] = useState(false)

  const handleExpand = useCallback(async (style: PolishStyle) => {
    if (!text.trim()) return
    setIsExpanding(true)
    try {
      const result = await expandScene(text, style)
      setText(result)
      onUpdateNode(id, { ...data, text: result })
      showToast('success', '场景描写已扩写')
    } catch (error) {
      showToast('error', (error as Error).message)
    } finally {
      setIsExpanding(false)
    }
  }, [text, data, id, onUpdateNode, setText])

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">旁白文本</Label>
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Sparkles className="w-3 h-3 text-amber-500" />
            AI 扩写
          </span>
        </div>
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
        <div className="grid grid-cols-4 gap-1">
          {(['general', 'vivid', 'concise', 'literary'] as PolishStyle[]).map((style) => (
            <button
              key={style}
              onClick={() => handleExpand(style)}
              disabled={isExpanding || !text.trim()}
              className="py-1 px-1.5 text-[10px] rounded border border-border/60 hover:border-amber-500/50 hover:bg-amber-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExpanding ? '...' : style === 'general' ? '补充' : style === 'vivid' ? '生动' : style === 'concise' ? '精简' : '文学'}
            </button>
          ))}
        </div>
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

      {/* 音频控制 */}
      <div className="space-y-2 pt-2 border-t border-border/40">
        <Label className="text-xs">背景音乐 (BGM)</Label>
        <div className="flex items-center gap-2">
          <Input
            value={(data as any).bgm || ''}
            onChange={(e) => onUpdateNode(id, { ...data, bgm: e.target.value })}
            placeholder="BGM URL"
            className="text-sm flex-1"
          />
          {(data as any).bgm && (
            <button onClick={() => onUpdateNode(id, { ...data, bgm: '' })}
              className="text-xs text-red-400 hover:text-red-600 px-2">清除</button>
          )}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>音量</span>
            <span>{Math.round(((data as any).bgmVolume ?? 0.3) * 100)}%</span>
          </div>
          <input type="range" min="0" max="1" step="0.05"
            value={(data as any).bgmVolume ?? 0.3}
            onChange={(e) => onUpdateNode(id, { ...data, bgmVolume: Number(e.target.value) })}
            className="w-full accent-purple-500" />
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
'use client'

import { Label } from '@editor/components/ui/label'
import { Input } from '@editor/components/ui/input'
import { Textarea } from '@editor/components/ui/textarea'
import type { BasePanelProps } from './shared-props'
import { ENDING_TYPES } from './shared-props'
import { useDebouncedState } from '@editor/lib/use-debounced-state'
import { AiAssistButton } from '../ai-assist-button'

export function EndingPanel({ node, onUpdateNode }: BasePanelProps) {
  const { data, id } = node

  const [title, setTitle, flushTitle] = useDebouncedState(
    (data as any).title || '',
    300,
    (value) => onUpdateNode(id, { ...data, title: value })
  )

  const [text, setText, flushText] = useDebouncedState(
    (data as any).text || '',
    300,
    (value) => onUpdateNode(id, { ...data, text: value })
  )

  return (
    <>
      <div className="space-y-2">
        <Label className="text-xs">结局标题</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => flushTitle()}
          placeholder="输入结局标题..."
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">结局类型</Label>
        <select
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={(data as any).endingType || 'neutral'}
          onChange={(e) => onUpdateNode(id, { ...data, endingType: e.target.value })}
        >
          {ENDING_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">结局描述</Label>
          <div className="flex items-center gap-1">
            <AiAssistButton
              mode="polish"
              context={text}
              onResult={(result) => setText(result)}
              size="sm"
            />
            <AiAssistButton
              mode="expand"
              context={`结局标题：${title}\n当前描述：${text}`}
              onResult={(result) => setText(result)}
              size="sm"
              label="扩写"
            />
          </div>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => flushText()}
          placeholder="输入结局描述..."
          className="min-h-[100px] resize-none text-sm"
        />
      </div>

      <div className="space-y-2 pt-2 border-t border-border/40">
        <Label className="text-xs">封面图片（可选）</Label>
        <Input
          value={(data as any).coverImage || ''}
          onChange={(e) => onUpdateNode(id, { ...data, coverImage: e.target.value })}
          placeholder="封面图片URL"
          className="text-sm"
        />
        {(data as any).coverImage && (
          <div className="relative rounded-lg overflow-hidden border border-border">
            <img src={(data as any).coverImage} alt="结局封面" className="w-full h-24 object-cover" />
          </div>
        )}
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
    </>
  )
}
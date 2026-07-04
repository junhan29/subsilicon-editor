'use client'

import { Label } from '@editor/components/ui/label'
import { Input } from '@editor/components/ui/input'
import { Textarea } from '@editor/components/ui/textarea'
import type { BasePanelProps } from './shared-props'
import { ENDING_TYPES } from './shared-props'
import { useDebouncedState } from '@editor/lib/use-debounced-state'

export function EndingPanel({ node, onUpdateNode }: BasePanelProps) {
  const { data, id } = node

  const [title, setTitle] = useDebouncedState(
    (data as any).title || '',
    300,
    (value) => onUpdateNode(id, { ...data, title: value })
  )

  const [text, setText] = useDebouncedState(
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
          onBlur={() => {
            const finalValue = title
            onUpdateNode(id, { ...data, title: finalValue })
          }}
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
        <Label className="text-xs">结局描述</Label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const finalValue = text
            onUpdateNode(id, { ...data, text: finalValue })
          }}
          placeholder="输入结局描述..."
          className="min-h-[100px] resize-none text-sm"
        />
      </div>
    </>
  )
}
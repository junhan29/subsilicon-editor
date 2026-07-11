'use client'

import { useState, useCallback } from 'react'
import { Label } from '@editor/components/ui/label'
import { Input } from '@editor/components/ui/input'
import { Textarea } from '@editor/components/ui/textarea'
import { Button } from '@editor/components/ui/button'
import { Slider } from '@editor/components/ui/slider'
import { Image, Music, Palette, Type, Eye, X, Sparkles } from 'lucide-react'
import type { BasePanelProps } from './shared-props'
import { TEXT_ANIMATION_TYPES, ENTER_ANIMATION_TYPES, SPRITE_POSITION_TYPES, DIALOG_STYLE_TYPES, DIALOG_COLOR_OPTIONS } from './shared-props'
import { useDebouncedState } from '@editor/lib/use-debounced-state'
import { polishDialogue, type PolishStyle } from '@editor/lib/ai-service'
import { showToast } from '../toast'

export function DialoguePanel({ node, characters, variables, assets, scenes, onUpdateNode, onOpenAssets }: BasePanelProps) {
  const { data, id } = node
  const characterId = (data as any).characterId || ''
  const selectedChar = characters.find(c => c.id === characterId)
  const sprites = selectedChar?.sprites || []
  const currentEmotion = (data as any).emotion || ''

  const [text, setText] = useDebouncedState(
    (data as any).text || '',
    300,
    (value) => onUpdateNode(id, { ...data, text: value })
  )

  const [emotion, setEmotion] = useDebouncedState(
    (data as any).emotion || '',
    300,
    (value) => onUpdateNode(id, { ...data, emotion: value })
  )
  const [isPolishing, setIsPolishing] = useState(false)

  const handlePolish = useCallback(async (style: PolishStyle) => {
    if (!text.trim() || !characterId) return
    setIsPolishing(true)
    try {
      const char = characters.find((c) => c.id === characterId)
      const result = await polishDialogue(text, {
        name: char?.name || '',
        personality: char?.personality,
        speechTone: char?.speech?.tone,
      }, style)
      setText(result)
      onUpdateNode(id, { ...data, text: result })
      showToast('success', '对话已润色')
    } catch (error) {
      showToast('error', (error as Error).message)
    } finally {
      setIsPolishing(false)
    }
  }, [text, characterId, characters, data, id, onUpdateNode, setText])

  return (
    <>
      <div className="space-y-2">
        <Label className="text-xs">角色</Label>
        <select
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={characterId}
          onChange={(e) => onUpdateNode(id, { ...data, characterId: e.target.value, emotion: '' })}
        >
          <option value="">选择角色</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* 角色立绘表情选择 */}
        {characterId && sprites.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">立绘表情（点击切换）</Label>
            <div className="flex gap-1.5 flex-wrap">
              {sprites.map((sprite) => {
                const isActive = currentEmotion === sprite.emotion
                return (
                  <button
                    key={sprite.id}
                    onClick={() => onUpdateNode(id, { ...data, emotion: sprite.emotion })}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                      isActive ? 'border-pink-500 ring-1 ring-pink-500' : 'border-border hover:border-slate-400'
                    }`}
                    title={sprite.name}
                  >
                    <img
                      src={sprite.url || `https://picsum.photos/seed/${characterId}-${sprite.emotion}/80/100`}
                      alt={sprite.name}
                      className="w-10 h-12 object-cover"
                    />
                    {isActive && <div className="absolute inset-0 bg-pink-500/20" />}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] text-center py-0.5 truncate">
                      {sprite.name}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">台词内容</Label>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Sparkles className="w-3 h-3 text-amber-500" />
              AI 润色
            </span>
          </div>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const finalValue = text
            onUpdateNode(id, { ...data, text: finalValue })
          }}
          placeholder="输入角色台词..."
          className="min-h-[100px] resize-none text-sm"
        />
        <div className="grid grid-cols-4 gap-1">
          {(['general', 'vivid', 'concise', 'literary'] as PolishStyle[]).map((style) => (
            <button
              key={style}
              onClick={() => handlePolish(style)}
              disabled={isPolishing || !text.trim() || !characterId}
              className="py-1 px-1.5 text-[10px] rounded border border-border/60 hover:border-amber-500/50 hover:bg-amber-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPolishing ? '...' : style === 'general' ? '自然' : style === 'vivid' ? '生动' : style === 'concise' ? '精简' : '文学'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">表情标签（可选）</Label>
        <Input
          value={emotion}
          onChange={(e) => setEmotion(e.target.value)}
          onBlur={() => {
            const finalValue = emotion
            onUpdateNode(id, { ...data, emotion: finalValue })
          }}
          placeholder="如：开心、愤怒、惊讶"
          className="text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label className="text-xs">角色位置</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={(data as any).spritePosition || 'center'}
            onChange={(e) => onUpdateNode(id, { ...data, spritePosition: e.target.value })}
          >
            {SPRITE_POSITION_TYPES.map((pos) => (
              <option key={pos.value} value={pos.value}>{pos.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">入场动画</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={(data as any).enterAnimation || 'fade-in'}
            onChange={(e) => onUpdateNode(id, { ...data, enterAnimation: e.target.value })}
          >
            {ENTER_ANIMATION_TYPES.map((anim) => (
              <option key={anim.value} value={anim.value}>{anim.label}</option>
            ))}
          </select>
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

      {/* 场景素材 */}
      {scenes && scenes.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs">选择场景</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {scenes.map((scene) => {
              const isSelected = (data as any).sceneId === scene.id
              return (
                <button
                  key={scene.id}
                  onClick={() => {
                    if (isSelected) {
                      onUpdateNode(id, { ...data, sceneId: '', backgroundImage: (data as any).backgroundImage })
                    } else {
                      onUpdateNode(id, { ...data, sceneId: scene.id, backgroundImage: scene.backgroundImage })
                    }
                  }}
                  className={`relative aspect-video rounded-md overflow-hidden border transition-all ${
                    isSelected ? 'border-pink-500 ring-1 ring-pink-500' : 'border-border hover:border-pink-500/50'
                  }`}
                >
                  <img src={scene.backgroundImage} alt={scene.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5">
                    <p className="text-[9px] text-white truncate">{scene.name}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 背景图片 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">背景图片</Label>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => onOpenAssets?.('images')}>
            <Image className="w-3 h-3 mr-1" />管理素材
          </Button>
        </div>
        {(data as any).backgroundImage ? (
          <div className="relative rounded-lg overflow-hidden border border-border">
            <img src={(data as any).backgroundImage} alt="" className="w-full h-24 object-cover" />
            <Button variant="ghost" size="sm" className="absolute top-1 right-1 h-6 w-6 p-0 bg-black/40 hover:bg-black/60 text-white"
              onClick={() => onUpdateNode(id, { ...data, backgroundImage: '' })}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {(assets?.images || []).slice(0, 8).map((img, i) => (
              <button key={i} onClick={() => onUpdateNode(id, { ...data, backgroundImage: img })}
                className="aspect-square rounded-md border border-border overflow-hidden hover:border-primary transition-colors">
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 背景音乐 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">背景音乐</Label>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => onOpenAssets?.('audios')}>
            <Music className="w-3 h-3 mr-1" />管理素材
          </Button>
        </div>
        {(data as any).bgm ? (
          <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30">
            <Music className="w-4 h-4 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs truncate">已设置背景音乐</p>
            </div>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => onUpdateNode(id, { ...data, bgm: '' })}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {(assets?.audios || []).slice(0, 5).map((audio, i) => (
              <button key={i} onClick={() => onUpdateNode(id, { ...data, bgm: audio })}
                className="w-full flex items-center gap-2 p-2 rounded-md border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-left">
                <Music className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-xs truncate flex-1">音频 {i + 1}</span>
              </button>
            ))}
          </div>
        )}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>BGM 音量</span>
            <span>{Math.round(((data as any).bgmVolume ?? 0.3) * 100)}%</span>
          </div>
          <input type="range" min="0" max="1" step="0.05"
            value={(data as any).bgmVolume ?? 0.3}
            onChange={(e) => onUpdateNode(id, { ...data, bgmVolume: Number(e.target.value) })}
            className="w-full accent-purple-500" />
        </div>
      </div>

      {/* 环境音 BGS */}
      <div className="space-y-2 pt-2 border-t border-border/40">
        <Label className="text-xs">环境音 (BGS)</Label>
        <div className="flex items-center gap-2">
          <Input
            value={(data as any).bgs || ''}
            onChange={(e) => onUpdateNode(id, { ...data, bgs: e.target.value })}
            placeholder="BGS URL"
            className="text-sm flex-1"
          />
          {(data as any).bgs && (
            <button onClick={() => onUpdateNode(id, { ...data, bgs: '' })}
              className="text-xs text-red-400 hover:text-red-600 px-2">清除</button>
          )}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>音量</span>
            <span>{Math.round(((data as any).bgsVolume ?? 0.2) * 100)}%</span>
          </div>
          <input type="range" min="0" max="1" step="0.05"
            value={(data as any).bgsVolume ?? 0.2}
            onChange={(e) => onUpdateNode(id, { ...data, bgsVolume: Number(e.target.value) })}
            className="w-full accent-blue-500" />
        </div>
      </div>

      {/* 音效 SE */}
      <div className="space-y-2 pt-2 border-t border-border/40">
        <Label className="text-xs">音效 (SE)</Label>
        <div className="flex items-center gap-2">
          <Input
            value={(data as any).seUrl || ''}
            onChange={(e) => onUpdateNode(id, { ...data, seUrl: e.target.value })}
            placeholder="SE URL"
            className="text-sm flex-1"
          />
          {(data as any).seUrl && (
            <button onClick={() => onUpdateNode(id, { ...data, seUrl: '' })}
              className="text-xs text-red-400 hover:text-red-600 px-2">清除</button>
          )}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>音量</span>
            <span>{Math.round(((data as any).seVolume ?? 0.5) * 100)}%</span>
          </div>
          <input type="range" min="0" max="1" step="0.05"
            value={(data as any).seVolume ?? 0.5}
            onChange={(e) => onUpdateNode(id, { ...data, seVolume: Number(e.target.value) })}
            className="w-full accent-green-500" />
        </div>
      </div>

      {/* 语音 Voice */}
      <div className="space-y-2 pt-2 border-t border-border/40">
        <Label className="text-xs">语音 (Voice)</Label>
        <div className="flex items-center gap-2">
          <Input
            value={(data as any).voiceUrl || ''}
            onChange={(e) => onUpdateNode(id, { ...data, voiceUrl: e.target.value })}
            placeholder="Voice URL"
            className="text-sm flex-1"
          />
          {(data as any).voiceUrl && (
            <button onClick={() => onUpdateNode(id, { ...data, voiceUrl: '' })}
              className="text-xs text-red-400 hover:text-red-600 px-2">清除</button>
          )}
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
        <Label className="text-xs">对话框样式</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {DIALOG_STYLE_TYPES.map((style) => {
            const isActive = (data as any).dialogStyle === style.id || (!(data as any).dialogStyle && style.id === 'default')
            return (
              <button key={style.id} onClick={() => onUpdateNode(id, { ...data, dialogStyle: style.id })}
                className={`py-1.5 px-2 rounded-lg text-[10px] font-medium transition-all ${
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                }`}>
                {style.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">对话框颜色</Label>
        <div className="flex gap-1.5 flex-wrap">
          {DIALOG_COLOR_OPTIONS.map((c) => {
            const isActive = (data as any).dialogColor === c.color
            return (
              <button key={c.color} onClick={() => onUpdateNode(id, { ...data, dialogColor: isActive ? '' : c.color })}
                className={`w-8 h-8 rounded-lg border-2 transition-all ${
                  isActive ? 'border-primary scale-110' : 'border-border hover:scale-105'
                }`}
                style={{ backgroundColor: c.color }} title={c.label} />
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">
          对话框透明度
          <span className="ml-1 text-muted-foreground">
            {Math.round(((data as any).dialogOpacity || 0.9) * 100)}%
          </span>
        </Label>
        <Slider value={[(data as any).dialogOpacity || 0.9]} onValueChange={([v]) => onUpdateNode(id, { ...data, dialogOpacity: v })}
          min={0.3} max={1} step={0.05} />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">文本动画</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: 'typewriter', label: '打字机' },
            { id: 'fade-in', label: '淡入' },
            { id: 'slide-up', label: '上滑' },
            { id: 'none', label: '无动画' },
          ].map((anim) => {
            const isActive = (data as any).textAnimation === anim.id || (!(data as any).textAnimation && anim.id === 'typewriter')
            return (
              <button key={anim.id} onClick={() => onUpdateNode(id, { ...data, textAnimation: anim.id })}
                className={`py-1.5 px-2 rounded-lg text-[10px] font-medium transition-all ${
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                }`}>
                <Type className="w-3 h-3 inline mr-1" />
                {anim.label}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
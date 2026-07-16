'use client'

import { useState } from 'react'
import { Label } from '@editor/components/ui/label'
import { Input } from '@editor/components/ui/input'
import { Button } from '@editor/components/ui/button'
import { Image, Play, Pause, RotateCcw, ChevronDown, ChevronUp, Plus, Trash2, Layers, Upload } from 'lucide-react'
import { Toggle } from '@editor/components/ui/toggle'
import { LocalFileInput } from './local-file-input'
import type { BasePanelProps } from './shared-props'
import { TRANSITION_TYPES } from './shared-props'
import type { CgOverlayLayer } from '@editor/types/editor'

export function CGPanel({ node, onOpenAssets, onUpdateNode }: BasePanelProps) {
  const { data, id } = node
  const d = data as any
  const mediaType = d.mediaType || 'image'
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showVideoControls, setShowVideoControls] = useState(false)
  const [showTransform, setShowTransform] = useState(false)
  const [showOverlayLayers, setShowOverlayLayers] = useState(false)

  const updateData = (patch: Record<string, unknown>) => {
    onUpdateNode(id, { ...d, ...patch })
  }

  const overlayLayers: CgOverlayLayer[] = d.overlayLayers || []

  const updateOverlayLayers = (layers: CgOverlayLayer[]) => {
    updateData({ overlayLayers: layers })
  }

  const addOverlayLayer = () => {
    const newLayer: CgOverlayLayer = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ol-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url: '',
      x: 50,
      y: 50,
      width: 30,
      opacity: 1,
      rotation: 0,
      zIndex: overlayLayers.length,
    }
    updateOverlayLayers([...overlayLayers, newLayer])
  }

  const updateOverlayLayer = (layerId: string, patch: Partial<CgOverlayLayer>) => {
    updateOverlayLayers(overlayLayers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)))
  }

  const removeOverlayLayer = (layerId: string) => {
    updateOverlayLayers(overlayLayers.filter((l) => l.id !== layerId))
  }

  const handleOverlayFileUpload = (layerId: string, file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      updateOverlayLayer(layerId, { url: reader.result as string })
    }
    reader.readAsDataURL(file)
  }

  return (
    <>
      <div className="space-y-2">
        <Label className="text-xs">媒体类型</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => updateData({ mediaType: 'image' })}
            className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              mediaType === 'image' ? 'bg-purple-500 text-white' : 'bg-muted hover:bg-muted/80'
            }`}
          >
            图片 CG
          </button>
          <button
            onClick={() => updateData({ mediaType: 'video' })}
            className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              mediaType === 'video' ? 'bg-purple-500 text-white' : 'bg-muted hover:bg-muted/80'
            }`}
          >
            视频 CG
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">资源上传</Label>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => onOpenAssets?.(mediaType === 'video' ? 'audios' : 'images')}>
            <Image className="w-3 h-3 mr-1" />从素材库选择
          </Button>
        </div>
        <LocalFileInput
          accept={mediaType === 'video' ? 'video/*' : 'image/*'}
          maxSize={mediaType === 'video' ? 200 * 1024 * 1024 : 20 * 1024 * 1024}
          value={d.localFile || ''}
          onChange={(base64) => updateData({ localFile: base64 })}
          placeholder={mediaType === 'video' ? '点击或拖拽上传视频文件 (MP4/WebM, ≤200MB)' : '点击或拖拽上传图片 (JPG/PNG/WebP, ≤20MB)'}
        />
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] text-muted-foreground">或使用 URL</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <Input
          value={d.url || ''}
          onChange={(e) => updateData({ url: e.target.value })}
          placeholder="输入资源URL，如 https://..."
          className="text-sm"
        />
        {d.localFile && mediaType === 'image' && (
          <div className="relative rounded-lg overflow-hidden border border-border">
            <img src={d.localFile} alt="CG 预览" className="w-full h-32 object-cover" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs">CG 标题（可选）</Label>
        <Input
          value={d.title || ''}
          onChange={(e) => updateData({ title: e.target.value })}
          placeholder="输入标题..."
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">副标题（可选）</Label>
        <Input
          value={d.subtitle || ''}
          onChange={(e) => updateData({ subtitle: e.target.value })}
          placeholder="输入副标题..."
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">自动播放时长</Label>
          <span className="text-[10px] text-muted-foreground">
            {d.duration === 0 ? '点击继续' : `${Math.round((d.duration || 0) / 1000)} 秒`}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="10000"
          step="500"
          value={d.duration || 0}
          onChange={(e) => updateData({ duration: Number(e.target.value) })}
          className="w-full accent-purple-500"
        />
        <p className="text-[10px] text-muted-foreground">设为 0 则需要玩家点击继续</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">允许跳过</Label>
          <Toggle
            checked={d.canSkip !== false}
            onChange={(checked) => updateData({ canSkip: checked })}
            color="bg-purple-500"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">电影感黑边</Label>
          <Toggle
            checked={d.letterbox}
            onChange={(checked) => updateData({ letterbox: checked })}
            color="bg-purple-500"
          />
        </div>
      </div>

      {mediaType === 'video' && (
        <div className="space-y-2 pt-2 border-t border-border/40">
          <button
            onClick={() => setShowVideoControls(!showVideoControls)}
            className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Play className="w-3 h-3" />
              视频播放控制
            </span>
            {showVideoControls ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showVideoControls && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>起始时间（秒）</span>
                  <span>{d.startTime || 0}s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="0.5"
                  value={d.startTime || 0}
                  onChange={(e) => updateData({ startTime: Number(e.target.value) })}
                  className="w-full accent-purple-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>结束时间（秒）</span>
                  <span>{d.endTime || 0}s {!d.endTime ? '(到结尾)' : ''}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="300"
                  step="0.5"
                  value={d.endTime || 0}
                  onChange={(e) => updateData({ endTime: Number(e.target.value) })}
                  className="w-full accent-purple-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-[10px]">循环播放</Label>
                <Toggle
                  checked={d.loop || false}
                  onChange={(checked) => updateData({ loop: checked })}
                  color="bg-purple-500"
                />
              </div>

              {d.loop && (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>循环起始（秒）</span>
                      <span>{d.loopStartTime || d.startTime || 0}s</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="60"
                      step="0.5"
                      value={d.loopStartTime || d.startTime || 0}
                      onChange={(e) => updateData({ loopStartTime: Number(e.target.value) })}
                      className="w-full accent-purple-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>循环结束（秒）</span>
                      <span>{d.loopEndTime || d.endTime || 0}s</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="300"
                      step="0.5"
                      value={d.loopEndTime || d.endTime || 0}
                      onChange={(e) => updateData({ loopEndTime: Number(e.target.value) })}
                      className="w-full accent-purple-500"
                    />
                  </div>
                </>
              )}

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>播放速度</span>
                  <span>{d.playbackRate || 1}x</span>
                </div>
                <input
                  type="range"
                  min="0.25"
                  max="2"
                  step="0.25"
                  value={d.playbackRate || 1}
                  onChange={(e) => updateData({ playbackRate: Number(e.target.value) })}
                  className="w-full accent-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px]">静音</Label>
                  <Toggle
                    checked={d.muted || false}
                    onChange={(checked) => updateData({ muted: checked })}
                    color="bg-purple-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-[10px]">显示控件</Label>
                  <Toggle
                    checked={d.showControls || false}
                    onChange={(checked) => updateData({ showControls: checked })}
                    color="bg-purple-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2 pt-2 border-t border-border/40">
        <Label className="text-xs">显示比例</Label>
        <div className="grid grid-cols-4 gap-1">
          {[
            { value: 'contain', label: '完整' },
            { value: 'cover', label: '铺满' },
            { value: 'fill', label: '拉伸' },
            { value: 'custom', label: '自定义' },
          ].map((m) => (
            <button
              key={m.value}
              onClick={() => updateData({ displayMode: m.value })}
              className={`py-1.5 px-2 rounded-md text-[10px] font-medium transition-all ${
                (d.displayMode || 'contain') === m.value ? 'bg-purple-500 text-white' : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {(d.displayMode === 'custom') && (
          <>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>宽度</span>
                <span>{d.customWidth || 100}%</span>
              </div>
              <input type="range" min="10" max="100" step="5"
                value={d.customWidth || 100}
                onChange={(e) => updateData({ customWidth: Number(e.target.value) })}
                className="w-full accent-purple-500" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>高度</span>
                <span>{d.customHeight || 100}%</span>
              </div>
              <input type="range" min="10" max="100" step="5"
                value={d.customHeight || 100}
                onChange={(e) => updateData({ customHeight: Number(e.target.value) })}
                className="w-full accent-purple-500" />
            </div>
          </>
        )}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">图片位置</Label>
          <select
            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={d.objectPosition || 'center'}
            onChange={(e) => updateData({ objectPosition: e.target.value })}
          >
            <option value="center">居中</option>
            <option value="top">顶部</option>
            <option value="bottom">底部</option>
            <option value="left">左侧</option>
            <option value="right">右侧</option>
            <option value="center top">中上</option>
            <option value="center bottom">中下</option>
          </select>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-border/40">
        <button
          onClick={() => setShowTransform(!showTransform)}
          className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <RotateCcw className="w-3 h-3" />
            变换与样式
          </span>
          {showTransform ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showTransform && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>X 偏移</span>
                  <span>{d.x || 0}px</span>
                </div>
                <input type="range" min="-200" max="200" step="5"
                  value={d.x || 0}
                  onChange={(e) => updateData({ x: Number(e.target.value) })}
                  className="w-full accent-purple-500" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Y 偏移</span>
                  <span>{d.y || 0}px</span>
                </div>
                <input type="range" min="-200" max="200" step="5"
                  value={d.y || 0}
                  onChange={(e) => updateData({ y: Number(e.target.value) })}
                  className="w-full accent-purple-500" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>透明度</span>
                <span>{Math.round((d.opacity ?? 1) * 100)}%</span>
              </div>
              <input type="range" min="0" max="1" step="0.05"
                value={d.opacity ?? 1}
                onChange={(e) => updateData({ opacity: Number(e.target.value) })}
                className="w-full accent-purple-500" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>旋转角度</span>
                <span>{d.rotation || 0}°</span>
              </div>
              <input type="range" min="-180" max="180" step="5"
                value={d.rotation || 0}
                onChange={(e) => updateData({ rotation: Number(e.target.value) })}
                className="w-full accent-purple-500" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>圆角</span>
                <span>{d.borderRadius || 0}px</span>
              </div>
              <input type="range" min="0" max="50" step="2"
                value={d.borderRadius || 0}
                onChange={(e) => updateData({ borderRadius: Number(e.target.value) })}
                className="w-full accent-purple-500" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px]">阴影</Label>
                <Toggle
                  checked={d.shadow || false}
                  onChange={(checked) => updateData({ shadow: checked })}
                  color="bg-purple-500"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">边框粗细</Label>
                <input type="range" min="0" max="10" step="1"
                  value={d.borderWidth || 0}
                  onChange={(e) => updateData({ borderWidth: Number(e.target.value) })}
                  className="w-full accent-purple-500" />
              </div>
            </div>

            {d.borderWidth && d.borderWidth > 0 && (
              <div className="space-y-1">
                <Label className="text-[10px]">边框颜色</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {['#000000', '#ffffff', '#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ec4899'].map((color) => (
                    <button
                      key={color}
                      onClick={() => updateData({ borderColor: color })}
                      className={`w-6 h-6 rounded-md border-2 transition-all ${
                        d.borderColor === color ? 'border-purple-500 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-[10px]">背景填充色</Label>
              <div className="flex gap-1.5 flex-wrap">
                {['transparent', '#000000', '#1e293b', '#ffffff', '#0f172a'].map((color) => (
                  <button
                    key={color}
                    onClick={() => updateData({ fillColor: color })}
                    className={`w-6 h-6 rounded-md border-2 transition-all ${
                      d.fillColor === color ? 'border-purple-500 scale-110' : 'border-slate-600'
                    }`}
                    style={{ backgroundColor: color === 'transparent' ? 'repeating-linear-gradient(45deg, #334155, #334155 3px, #475569 3px, #475569 6px)' : color }}
                    title={color === 'transparent' ? '透明' : color}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2 pt-2 border-t border-border/40">
        <Label className="text-xs">入场转场</Label>
        <select
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={d.transitionIn || 'fade'}
          onChange={(e) => updateData({ transitionIn: e.target.value })}
        >
          {TRANSITION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">出场转场</Label>
        <select
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={d.transitionOut || 'fade'}
          onChange={(e) => updateData({ transitionOut: e.target.value })}
        >
          {TRANSITION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">转场时长（毫秒）</Label>
        <input
          type="number"
          min="0"
          max="5000"
          step="100"
          value={d.transitionDuration || 1000}
          onChange={(e) => updateData({ transitionDuration: Number(e.target.value) })}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>

      <div className="space-y-2 pt-2 border-t border-border/40">
        <Label className="text-xs">背景音乐 (BGM)</Label>
        <div className="flex items-center gap-2">
          <Input
            value={d.bgm || ''}
            onChange={(e) => updateData({ bgm: e.target.value })}
            placeholder="BGM URL"
            className="text-sm flex-1"
          />
          {d.bgm && (
            <button onClick={() => updateData({ bgm: '' })}
              className="text-xs text-red-400 hover:text-red-600 px-2">清除</button>
          )}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>音量</span>
            <span>{Math.round((d.bgmVolume ?? 0.3) * 100)}%</span>
          </div>
          <input type="range" min="0" max="1" step="0.05"
            value={d.bgmVolume ?? 0.3}
            onChange={(e) => updateData({ bgmVolume: Number(e.target.value) })}
            className="w-full accent-purple-500" />
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-border/40">
        <Label className="text-xs">音效 (SE)</Label>
        <div className="flex items-center gap-2">
          <Input
            value={d.soundEffect || ''}
            onChange={(e) => updateData({ soundEffect: e.target.value })}
            placeholder="音效 URL"
            className="text-sm flex-1"
          />
          {d.soundEffect && (
            <button onClick={() => updateData({ soundEffect: '' })}
              className="text-xs text-red-400 hover:text-red-600 px-2">清除</button>
          )}
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-border/40">
        <button
          onClick={() => setShowOverlayLayers(!showOverlayLayers)}
          className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Layers className="w-3 h-3" />
            叠加图层
            {overlayLayers.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[9px]">
                {overlayLayers.length}
              </span>
            )}
          </span>
          {showOverlayLayers ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showOverlayLayers && (
          <div className="space-y-3 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs"
              onClick={addOverlayLayer}
            >
              <Plus className="w-3 h-3 mr-1" />
              添加叠加图层
            </Button>

            {overlayLayers.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-2">
                暂无叠加图层，点击上方按钮添加
              </p>
            )}

            {overlayLayers.map((layer, index) => (
              <div key={layer.id} className="space-y-2 p-2 rounded-lg border border-border/60 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    图层 {index + 1}
                    {layer.name ? ` · ${layer.name}` : ''}
                  </span>
                  <button
                    onClick={() => removeOverlayLayer(layer.id)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                    title="删除图层"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">图片 URL</Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={layer.url || ''}
                      onChange={(e) => updateOverlayLayer(layer.id, { url: e.target.value })}
                      placeholder="输入图片URL或上传文件"
                      className="text-xs h-7 flex-1"
                    />
                    <label
                      className="flex items-center justify-center w-7 h-7 rounded-md border border-input bg-background hover:bg-muted cursor-pointer transition-colors shrink-0"
                      title="上传图片"
                    >
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleOverlayFileUpload(layer.id, file)
                          e.target.value = ''
                        }}
                      />
                      <Upload className="w-3 h-3" />
                    </label>
                  </div>
                  {layer.url && (
                    <div className="relative rounded-md overflow-hidden border border-border/40 mt-1">
                      <img src={layer.url} alt="叠加图层预览" className="w-full h-16 object-contain bg-black/20" />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>X 位置</span>
                    <span>{layer.x}%</span>
                  </div>
                  <input type="range" min="0" max="100" step="1"
                    value={layer.x}
                    onChange={(e) => updateOverlayLayer(layer.id, { x: Number(e.target.value) })}
                    className="w-full accent-purple-500" />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Y 位置</span>
                    <span>{layer.y}%</span>
                  </div>
                  <input type="range" min="0" max="100" step="1"
                    value={layer.y}
                    onChange={(e) => updateOverlayLayer(layer.id, { y: Number(e.target.value) })}
                    className="w-full accent-purple-500" />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>宽度</span>
                    <span>{layer.width}%</span>
                  </div>
                  <input type="range" min="5" max="100" step="1"
                    value={layer.width}
                    onChange={(e) => updateOverlayLayer(layer.id, { width: Number(e.target.value) })}
                    className="w-full accent-purple-500" />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>透明度</span>
                    <span>{Math.round((layer.opacity ?? 1) * 100)}%</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.05"
                    value={layer.opacity ?? 1}
                    onChange={(e) => updateOverlayLayer(layer.id, { opacity: Number(e.target.value) })}
                    className="w-full accent-purple-500" />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>旋转角度</span>
                    <span>{layer.rotation || 0}°</span>
                  </div>
                  <input type="range" min="-180" max="180" step="5"
                    value={layer.rotation || 0}
                    onChange={(e) => updateOverlayLayer(layer.id, { rotation: Number(e.target.value) })}
                    className="w-full accent-purple-500" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

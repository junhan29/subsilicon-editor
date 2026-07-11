'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@editor/components/ui/button'
import { Slider } from '@editor/components/ui/slider'
import { Label } from '@editor/components/ui/label'
import {
  Crop, RotateCw, Sun, Contrast, FlipHorizontal, FlipVertical,
  Play, Pause, Scissors, SkipBack, SkipForward, Undo2, Redo2,
} from 'lucide-react'

// ---- 图片编辑器 ----
interface ImageEditorProps {
  src: string
  onChange: (edited: string) => void
}

export function ImageEditor({ src, onChange }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rotation, setRotation] = useState(0)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const applyFilters = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = src

    await new Promise<void>((resolve) => {
      img.onload = () => {
        const rad = (rotation * Math.PI) / 180
        const w = rotation % 180 === 0 ? img.width : img.height
        const h = rotation % 180 === 0 ? img.height : img.width
        canvas.width = w
        canvas.height = h

        ctx.save()
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`
        ctx.translate(w / 2, h / 2)
        ctx.rotate(rad)
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
        ctx.drawImage(img, -img.width / 2, -img.height / 2)
        ctx.restore()

        const result = canvas.toDataURL('image/png')
        onChange(result)
        resolve()
      }
    })
  }, [src, rotation, brightness, contrast, flipH, flipV, onChange])

  const pushHistory = () => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(JSON.stringify({ rotation, brightness, contrast, flipH, flipV }))
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  const undo = () => {
    if (historyIndex < 0) return
    const state = JSON.parse(history[historyIndex])
    setRotation(state.rotation)
    setBrightness(state.brightness)
    setContrast(state.contrast)
    setFlipH(state.flipH)
    setFlipV(state.flipV)
    setHistoryIndex(historyIndex - 1)
  }

  const redo = () => {
    if (historyIndex >= history.length - 2) return
    const state = JSON.parse(history[historyIndex + 2])
    setRotation(state.rotation)
    setBrightness(state.brightness)
    setContrast(state.contrast)
    setFlipH(state.flipH)
    setFlipV(state.flipV)
    setHistoryIndex(historyIndex + 1)
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-lg overflow-hidden border border-border bg-checkerboard">
        <img
          src={src}
          alt="编辑预览"
          className="w-full h-40 object-contain"
          style={{
            transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
            filter: `brightness(${brightness}%) contrast(${contrast}%)`,
          }}
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => { pushHistory(); setRotation((r) => (r + 90) % 360) }}
          title="旋转90°"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => { pushHistory(); setFlipH((f) => !f) }}
          title="水平翻转"
        >
          <FlipHorizontal className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => { pushHistory(); setFlipV((f) => !f) }}
          title="垂直翻转"
        >
          <FlipVertical className="w-3.5 h-3.5" />
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={undo}
          disabled={historyIndex < 0}
          title="撤销"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={redo}
          disabled={historyIndex >= history.length - 2}
          title="重做"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Sun className="w-3 h-3" /> 亮度
          </Label>
          <span className="text-[10px] text-muted-foreground">{brightness}%</span>
        </div>
        <Slider
          value={[brightness]}
          onValueChange={([v]) => setBrightness(v)}
          min={0}
          max={200}
          step={1}
          onPointerDown={pushHistory}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Contrast className="w-3 h-3" /> 对比度
          </Label>
          <span className="text-[10px] text-muted-foreground">{contrast}%</span>
        </div>
        <Slider
          value={[contrast]}
          onValueChange={([v]) => setContrast(v)}
          min={0}
          max={200}
          step={1}
          onPointerDown={pushHistory}
          className="w-full"
        />
      </div>

      <Button
        size="sm"
        className="w-full text-xs"
        onClick={applyFilters}
      >
        应用调整
      </Button>
    </div>
  )
}

// ---- 音频修剪器 ----
interface AudioTrimmerProps {
  duration: number // 总时长（秒）
  onChange: (start: number, end: number) => void
}

export function AudioTrimmer({ duration, onChange }: AudioTrimmerProps) {
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(duration)

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-2">
      <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
        <Scissors className="w-3 h-3" /> 音频修剪
      </Label>

      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <span>开始</span>
        <div className="flex-1" />
        <span>{formatTime(start)}</span>
        <span className="mx-1">-</span>
        <span>{formatTime(end)}</span>
        <div className="flex-1" />
        <span>结束</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">起始位置</span>
        </div>
        <Slider
          value={[start]}
          onValueChange={([v]) => { setStart(v); onChange(v, end) }}
          min={0}
          max={duration}
          step={0.1}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">结束位置</span>
        </div>
        <Slider
          value={[end]}
          onValueChange={([v]) => { setEnd(v); onChange(start, v) }}
          min={0}
          max={duration}
          step={0.1}
        />
      </div>
    </div>
  )
}

// ---- 视频修剪器 ----
interface VideoTrimmerProps {
  duration: number
  onChange: (start: number, end: number) => void
}

export function VideoTrimmer({ duration, onChange }: VideoTrimmerProps) {
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(duration)

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-2">
      <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
        <Scissors className="w-3 h-3" /> 视频修剪
      </Label>

      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <span>开始</span>
        <div className="flex-1" />
        <span>{formatTime(start)}</span>
        <span className="mx-1">-</span>
        <span>{formatTime(end)}</span>
        <div className="flex-1" />
        <span>结束</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">起始位置</span>
        </div>
        <Slider
          value={[start]}
          onValueChange={([v]) => { setStart(v); onChange(v, end) }}
          min={0}
          max={duration}
          step={0.1}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">结束位置</span>
        </div>
        <Slider
          value={[end]}
          onValueChange={([v]) => { setEnd(v); onChange(start, v) }}
          min={0}
          max={duration}
          step={0.1}
        />
      </div>
    </div>
  )
}
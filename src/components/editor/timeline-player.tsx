/**
 * 时间线预览播放器（编辑器内预览）
 *
 * 按时间线顺序播放片段（video/image/audio），叠加字幕。
 * 编辑器内创作者可观看全部内容；付费遮罩仅出现在导出物中。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import type { VideoClipType } from '@editor/lib/work-types/video'

export interface PlayerClip {
  id: string
  type: VideoClipType
  /** 可播放 URL（objectURL / dataURL） */
  src: string
  /** 片段时长（秒） */
  dur: number
  /** 截取起点（秒） */
  trimStart: number
  subtitle?: string
}

interface TimelinePlayerProps {
  clips: PlayerClip[]
  /** 播放完成后回调 */
  onEnd?: () => void
  compact?: boolean
}

function fmt(sec: number): string {
  sec = Math.max(0, Math.floor(sec))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`
}

export function TimelinePlayer({ clips, onEnd, compact }: TimelinePlayerProps) {
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)
  const vidRef = useRef<HTMLVideoElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const timerRef = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  /** 当前片段开始播放的时间戳 */
  const segStartRef = useRef(0)
  /** 当前片段之前的累计时长（秒） */
  const baseRef = useRef(0)

  const totalDuration = useCallback(() => {
    return clips.reduce((s, c) => s + (c.dur || 0), 0)
  }, [clips])

  const current = clips[idx]

  useEffect(() => {
    setTotal(totalDuration())
    setIdx(0)
    setProgress(0)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      if (audioRef.current) audioRef.current.pause()
    }
  }, [clips, totalDuration])

  const stop = useCallback(() => {
    setPlaying(false)
    if (timerRef.current) window.clearTimeout(timerRef.current)
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    const v = vidRef.current
    if (v) v.pause()
  }, [])

  const playIndex = useCallback((i: number) => {
    if (i >= clips.length) {
      stop()
      onEnd?.()
      return
    }
    const c = clips[i]
    setIdx(i)
    setPlaying(true)
    const base = clips.slice(0, i).reduce((s, x) => s + (x.dur || 0), 0)
    baseRef.current = base
    segStartRef.current = Date.now()
    setProgress(base)

    if (c.type === 'image') {
      const v = vidRef.current
      if (v) { v.pause(); v.style.display = 'none' }
      const img = imgRef.current
      if (img) { img.src = c.src; img.style.display = 'block' }
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => playIndex(i + 1), c.dur * 1000)
      return
    }
    if (c.type === 'audio') {
      const v = vidRef.current
      if (v) { v.pause(); v.style.display = 'none' }
      const img = imgRef.current
      if (img) img.style.display = 'none'
      const au = new Audio(c.src)
      try { au.currentTime = c.trimStart || 0 } catch { /* ignore */ }
      au.play().catch(() => {})
      audioRef.current = au
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => playIndex(i + 1), c.dur * 1000)
      return
    }
    // video
    const img = imgRef.current
    if (img) img.style.display = 'none'
    const v = vidRef.current
    if (v) {
      v.style.display = 'block'
      v.src = c.src
      try { v.currentTime = c.trimStart || 0 } catch { /* ignore */ }
      v.play().catch(() => {})
      v.ontimeupdate = () => {
        const start = c.trimStart || 0
        if (v.currentTime - start >= c.dur) {
          v.ontimeupdate = null
          playIndex(i + 1)
        }
      }
    }
  }, [clips, onEnd, stop])

  const toggle = () => {
    if (playing) stop()
    else {
      if (idx >= clips.length) { setIdx(0); playIndex(0) }
      else playIndex(idx)
    }
  }

  const restart = () => {
    stop()
    setIdx(0)
    setProgress(0)
    playIndex(0)
  }

  // 进度推进：播放期间按时间戳更新（覆盖 video/image/audio 全部类型）
  useEffect(() => {
    if (!playing) return
    const iv = window.setInterval(() => {
      setProgress(baseRef.current + (Date.now() - segStartRef.current) / 1000)
    }, 250)
    return () => window.clearInterval(iv)
  }, [playing])

  const width = total > 0 ? Math.min(100, (progress / total) * 100) : 0

  return (
    <div className="flex flex-col gap-2">
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-border">
        <video ref={vidRef} className="absolute inset-0 w-full h-full object-contain" playsInline muted={false} />
        <img ref={imgRef} alt="" className="absolute inset-0 w-full h-full object-contain" style={{ display: 'none' }} />
        {current?.subtitle && (
          <div className="absolute left-0 right-0 bottom-[6%] text-center text-white text-base px-4 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] pointer-events-none">
            {current.subtitle}
          </div>
        )}
        {clips.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            从左侧素材库添加片段，开始搭建时间线
          </div>
        )}
      </div>
      {!compact && (
        <div className="flex items-center gap-2.5">
          <button
            onClick={restart}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="重播"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggle}
            disabled={clips.length === 0}
            className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 transition-colors"
            title={playing ? '暂停' : '播放'}
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden cursor-pointer">
            <div className="h-full bg-primary/70 transition-[width] duration-200" style={{ width: `${width}%` }} />
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {fmt(progress)} / {fmt(total)}
          </span>
        </div>
      )}
    </div>
  )
}

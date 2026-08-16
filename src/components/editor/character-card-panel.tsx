'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ImagePlus, Loader2, Sparkles, Trash2, Upload } from 'lucide-react'
import type { StoryCharacter } from '@editor/types/editor'
import type { StoredAsset } from '@editor/lib/local-db'
import { findAssetsByAnnotation, getAssetURL, saveBlobAsAsset, updateAssetAnnotation } from '@editor/lib/local-db'
import {
  buildConsistentImagePrompt,
  generateCharacterPrompt,
  generateMediaForTask,
  getMediaProviderConfigForTask,
  optimizePrompt,
} from '@editor/lib/ai'
import { showToast } from './toast'

interface CharacterCardPanelProps {
  characters: StoryCharacter[]
}

/** 角色参考图状态（每个角色最多取一张，作为一致性锚点展示） */
const REF_USAGE = 'reference'

/**
 * 角色卡：为每个角色管理「参考图」——一致性锚点。
 * 支持上传参考图 / AI 一键生成立绘（自动设为参考图）/ 移除参考图。
 * 设好参考图后，AI 在生成该角色的立绘/CG 时会自动带上（ComfyUI IP-Adapter / 云端图生图）。
 */
export function CharacterCardPanel({ characters }: CharacterCardPanelProps) {
  const [refs, setRefs] = useState<Record<string, StoredAsset[]>>({})
  const [urls, setUrls] = useState<Record<string, string | null>>({})
  const [loadingChar, setLoadingChar] = useState<string | null>(null)
  const [uploadingChar, setUploadingChar] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const loadRefs = useCallback(async () => {
    const map: Record<string, StoredAsset[]> = {}
    for (const c of characters) {
      try {
        map[c.id] = await findAssetsByAnnotation({ characterId: c.id, usageType: REF_USAGE })
      } catch {
        map[c.id] = []
      }
    }
    setRefs(map)
  }, [characters])

  useEffect(() => {
    loadRefs()
  }, [loadRefs])

  // 参考图缩略图 object URL
  useEffect(() => {
    const next: Record<string, string | null> = {}
    let disposed = false
    Object.entries(refs).forEach(([charId, assets]) => {
      const asset = assets[0]
      if (!asset) return
      getAssetURL(asset.hash).then((url) => {
        if (!disposed && url) next[charId] = url
        if (!disposed) setUrls({ ...next })
      })
    })
    return () => {
      disposed = true
      Object.values(urls).forEach((u) => u && URL.revokeObjectURL(u))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refs])

  const refresh = async () => {
    await loadRefs()
  }

  const handleUpload = async (char: StoryCharacter, file: File) => {
    setUploadingChar(char.id)
    try {
      const ext = (file.type.split('/')[1] || 'png').split(';')[0]
      const hash = await saveBlobAsAsset(file, `char-ref-${char.id}.${ext}`)
      await updateAssetAnnotation(hash, {
        characterId: char.id,
        usageType: REF_USAGE,
        description: `${char.name} 参考图`,
      })
      await refresh()
      showToast('success', `${char.name} 参考图已设置`)
    } catch (e) {
      showToast('error', '参考图上传失败: ' + (e instanceof Error ? e.message : '未知错误'))
    } finally {
      setUploadingChar(null)
    }
  }

  const handleGenerateSprite = async (char: StoryCharacter) => {
    if (!getMediaProviderConfigForTask('image')) {
      showToast('error', '请先在创作助理设置中配置图片生成服务商')
      return
    }
    setLoadingChar(char.id)
    try {
      const style = 'anime'
      const desc = generateCharacterPrompt(char)
      // 已存在参考图时自动作为一致性锚点，后续生成复用同一形象
      const existingRef = refs[char.id]?.[0]?.hash
      const enhanced = buildConsistentImagePrompt(
        `${desc}, character portrait, full body, clean background, character sheet`,
        [char],
        style
      )
      const optimized = await optimizePrompt(enhanced, 'image', style)
      const result = await generateMediaForTask('image', {
        prompt: optimized,
        width: 1024,
        height: 1024,
        style: style as any,
        referenceImageHash: existingRef,
      })

      const resp = await fetch(result.url)
      if (!resp.ok) throw new Error(`拉取生成结果失败: ${resp.status}`)
      const blob = await resp.blob()
      const hash = await saveBlobAsAsset(blob, `char-sprite-${char.id}-${Date.now()}.png`)
      await updateAssetAnnotation(hash, {
        characterId: char.id,
        usageType: REF_USAGE,
        description: `${char.name} AI 立绘`,
      })
      if (result.cleanup) result.cleanup()
      await refresh()
      showToast('success', `${char.name} 立绘已生成并设为参考图`)
    } catch (e) {
      if (e instanceof Error && 'needsConfig' in e && (e as { needsConfig: boolean }).needsConfig) {
        showToast('error', '创作助理未配置，请在设置中配置 API Key')
      } else {
        showToast('error', '立绘生成失败: ' + (e instanceof Error ? e.message : '未知错误'))
      }
    } finally {
      setLoadingChar(null)
    }
  }

  const handleRemoveRef = async (char: StoryCharacter) => {
    const asset = refs[char.id]?.[0]
    if (!asset) return
    try {
      // 仅移除 reference 用途标注，保留角色关联等其他标注
      const annotation = { ...(asset.annotation || {}) }
      delete annotation.usageType
      await updateAssetAnnotation(asset.hash, annotation)
      await refresh()
      showToast('success', `${char.name} 参考图已移除`)
    } catch (e) {
      showToast('error', '移除失败: ' + (e instanceof Error ? e.message : '未知错误'))
    }
  }

  if (characters.length === 0) return null

  return (
    <div className="rounded-lg border border-border/60 bg-background overflow-hidden">
      <div className="p-2.5 border-b border-border/40">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <ImagePlus className="w-3.5 h-3.5 text-primary" />
          角色参考图（一致性锚点）
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          为角色设置参考图后，AI 生成立绘/CG 会自动保持一致（ComfyUI IP-Adapter 或云端图生图）
        </p>
      </div>

      <div className="divide-y divide-border/40">
        {characters.map((char) => {
          const ref = refs[char.id]?.[0]
          const thumb = urls[char.id]
          const busy = loadingChar === char.id || uploadingChar === char.id
          return (
            <div key={char.id} className="p-2.5 flex items-center gap-2.5">
              {/* 参考图缩略图 */}
              <div className="w-11 h-11 rounded-md overflow-hidden shrink-0 border border-border/60 bg-muted/40 flex items-center justify-center">
                {thumb ? (
                  <img src={thumb} alt={`${char.name} 参考图`} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[9px] text-muted-foreground px-1 text-center">未设置</span>
                )}
              </div>

              {/* 角色名 + 状态 */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate flex items-center gap-1">
                  {char.name}
                  {ref && <Check className="w-3 h-3 text-emerald-500 shrink-0" />}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {ref ? '已设置参考图' : 'AI 生成会自动锚定此形象'}
                </p>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-1 shrink-0">
                <input
                  ref={(el) => { fileInputRefs.current[char.id] = el }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleUpload(char, f)
                    e.target.value = ''
                  }}
                />
                <button
                  onClick={() => fileInputRefs.current[char.id]?.click()}
                  disabled={busy}
                  title="上传参考图"
                  className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors disabled:opacity-40"
                >
                  {uploadingChar === char.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => handleGenerateSprite(char)}
                  disabled={busy}
                  title="AI 生成立绘并设为参考图"
                  className="p-1.5 rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
                >
                  {loadingChar === char.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                </button>
                {ref && (
                  <button
                    onClick={() => handleRemoveRef(char)}
                    disabled={busy}
                    title="移除参考图"
                    className="p-1.5 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

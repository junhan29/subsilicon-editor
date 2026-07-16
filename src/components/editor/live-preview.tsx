'use client'

import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2 } from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import { RuntimeSceneRenderer } from './puzzle/runtime-scene-renderer'
import { AudioManager, createAudioManager } from '@editor/lib/audio-manager'
import type { StoryNode, StoryCharacter, ComicScene, ComicAudio } from '@editor/types/editor'

interface LivePreviewProps {
  nodes: StoryNode[]
  characters: StoryCharacter[]
  scenes?: ComicScene[]
  audios?: ComicAudio[]
  selectedNodeId: string | null
  onNodeSelect?: (nodeId: string) => void
  className?: string
}

const DEFAULT_BG = 'https://picsum.photos/seed/studio/800/600'

const fontSizeClass: Record<string, string> = { '14px': 'text-sm', '16px': 'text-base', '18px': 'text-lg', '20px': 'text-xl', '24px': 'text-2xl', base: 'text-base' }
const lineHeightClass: Record<string, string> = { relaxed: 'leading-relaxed', normal: 'leading-normal', tight: 'leading-tight' }

function LivePreview({
  nodes,
  characters,
  scenes = [],
  audios = [],
  selectedNodeId,
  onNodeSelect,
  className = '',
}: LivePreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [displayText, setDisplayText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [sceneTransition, setSceneTransition] = useState(false)
  const [characterEntering, setCharacterEntering] = useState(false)
  const audioManager = useRef<AudioManager | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    audioManager.current = createAudioManager()
    return () => {
      audioManager.current?.destroy()
      audioManager.current = null
    }
  }, [])

  const dialogueNodes = useMemo(() => {
    return nodes.filter((n) => n.type === 'dialogue' || n.type === 'choice' || n.type === 'narration' || n.type === 'ending' || n.type === 'cg' || n.type === 'condition' || n.type === 'random' || n.type === 'jump' || n.type === 'gather' || n.type === 'unlock')
  }, [nodes])

  const currentNode = dialogueNodes[currentIndex] || null

  const getCurrentScene = useCallback((): string => {
    if (scenes.length > 0 && scenes[0].backgroundImage) return scenes[0].backgroundImage
    return DEFAULT_BG
  }, [scenes])

  const getCurrentPuzzleScene = useCallback(() => {
    const sceneId = (currentNode?.data as any)?.sceneId
    if (sceneId) {
      const scene = scenes.find((s) => s.id === sceneId)
      if (scene?.puzzleData) return scene
    }
    return scenes.find((s) => s.puzzleData) || null
  }, [scenes, currentNode])

  const getCharacter = useCallback(
    (charId: string): StoryCharacter | undefined => {
      return characters.find((c) => c.id === charId)
    },
    [characters]
  )

  const getCharacterAvatar = useCallback(
    (charId: string): string => {
      const char = characters.find((c) => c.id === charId)
      return char?.avatar || `https://picsum.photos/seed/${charId || 'default'}/200/200`
    },
    [characters]
  )

  const getCharacterColor = useCallback(
    (charId: string): string => {
      const char = characters.find((c) => c.id === charId)
      return char?.color || '#6b7280'
    },
    [characters]
  )

  const getCharacterName = useCallback(
    (charId: string): string => {
      const char = characters.find((c) => c.id === charId)
      return char?.name || '未知角色'
    },
    [characters]
  )

  useEffect(() => {
    if (!currentNode) return
    setDisplayText('')
    setIsTyping(true)

    const text = (currentNode.data as any)?.text || ''
    const animation = (currentNode.data as any)?.textAnimation || 'typewriter'

    if (animation === 'typewriter' && text) {
      let i = 0
      const timer = setInterval(() => {
        if (i < text.length) {
          setDisplayText(text.slice(0, i + 1))
          i++
        } else {
          setIsTyping(false)
          clearInterval(timer)
        }
      }, 40)
      return () => clearInterval(timer)
    } else {
      setDisplayText(text)
      setIsTyping(false)
    }
  }, [currentIndex, currentNode])

  useEffect(() => {
    if (!selectedNodeId) return
    const idx = dialogueNodes.findIndex((n) => n.id === selectedNodeId)
    if (idx !== -1) {
      setCurrentIndex(idx)
    }
  }, [selectedNodeId, dialogueNodes])

  useEffect(() => {
    if (!mountedRef.current) return
    const node = dialogueNodes[currentIndex]
    if (!node) return
    const data = node.data as any

    if (data.bgm) {
      const currentBgm = audioManager.current?.getCurrentUrl('bgm')
      if (currentBgm !== data.bgm) {
        audioManager.current?.stop('bgm', 500)
        audioManager.current?.play('bgm', data.bgm, { loop: true, volume: data.bgmVolume || 0.3, fadeTime: 500 })
      }
    }

    if (data.bgs) {
      const currentBgs = audioManager.current?.getCurrentUrl('bgs')
      if (currentBgs !== data.bgs) {
        audioManager.current?.stop('bgs', 500)
        audioManager.current?.play('bgs', data.bgs, { loop: true, volume: data.bgsVolume || 0.2, fadeTime: 500 })
      }
    }

    if (data.seUrl) {
      audioManager.current?.play('se', data.seUrl, { loop: false, volume: data.seVolume || 0.5 })
    }

    if (data.voiceUrl) {
      audioManager.current?.play('voice', data.voiceUrl, { loop: false, volume: 0.8 })
    }
  }, [currentIndex, dialogueNodes])

  useEffect(() => {
    if (isMuted) {
      audioManager.current?.pauseAll()
    } else {
      audioManager.current?.resumeAll()
    }
  }, [isMuted])

  useEffect(() => {
    if (!isPlaying || !currentNode) return
    if (currentNode.type === 'choice') {
      setIsPlaying(false)
      return
    }
    if (currentNode.type === 'cg' && (currentNode.data as any)?.mediaType === 'video') {
      return
    }

    let delay: number
    if (currentNode.type === 'cg') {
      const d = currentNode.data as any
      delay = d.duration !== undefined && d.duration > 0 ? d.duration : (d.duration === 0 ? 0 : 3000)
    } else {
      const text = (currentNode.data as any)?.text || ''
      delay = Math.max(1500, text.length * 60)
    }

    if (delay === 0) return

    const timer = setTimeout(() => {
      if (currentIndex < dialogueNodes.length - 1) {
        goNext()
      } else {
        setIsPlaying(false)
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [isPlaying, currentIndex, currentNode, dialogueNodes.length])

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setCharacterEntering(true)
      setTimeout(() => { if (mountedRef.current) setCharacterEntering(false) }, 500)
    }
  }, [currentIndex])

  const goNext = useCallback(() => {
    if (currentIndex < dialogueNodes.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setCharacterEntering(true)
      setTimeout(() => { if (mountedRef.current) setCharacterEntering(false) }, 500)
      if (onNodeSelect && dialogueNodes[currentIndex + 1]) {
        onNodeSelect(dialogueNodes[currentIndex + 1].id)
      }
    }
  }, [currentIndex, dialogueNodes, onNodeSelect])

  const togglePlay = useCallback(() => {
    if (currentIndex >= dialogueNodes.length - 1) {
      setCurrentIndex(0)
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying, currentIndex, dialogueNodes.length])

  const handleSceneClick = () => {
    if (currentNode?.type === 'choice') return
    if (isTyping) {
      const text = (currentNode?.data as any)?.text || ''
      setDisplayText(text)
      setIsTyping(false)
    } else {
      goNext()
    }
  }

  const handleChoice = useCallback((opt: any) => {
    if (!opt) return
    if (opt.nextNodeId) {
      const idx = dialogueNodes.findIndex((n) => n.id === opt.nextNodeId)
      if (idx !== -1) {
        setCurrentIndex(idx)
        setCharacterEntering(true)
        setTimeout(() => { if (mountedRef.current) setCharacterEntering(false) }, 500)
        return
      }
    }
    goNext()
  }, [dialogueNodes, goNext])

  const renderCharacter = () => {
    if (!currentNode || currentNode.type !== 'dialogue') return null
    const charId = (currentNode.data as any)?.characterId
    if (!charId) return null

    const position = (currentNode.data as any)?.spritePosition || 'center'
    const emotion = (currentNode.data as any)?.emotion || 'normal'
    const enterAnim = (currentNode.data as any)?.enterAnimation || 'fade-in'

    const posClass = position === 'left' ? 'left-[10%]' : position === 'right' ? 'right-[10%]' : 'left-1/2 -translate-x-1/2'

    const animClass = characterEntering
      ? enterAnim === 'slide-left'
        ? 'animate-slide-in-left'
        : enterAnim === 'slide-right'
          ? 'animate-slide-in-right'
          : enterAnim === 'zoom'
            ? 'animate-zoom-in'
            : 'animate-fade-in'
      : ''

    const spriteUrl = `https://picsum.photos/seed/${charId}-${emotion}/300/450`

    return (
      <div
        className={`absolute bottom-0 ${posClass} transition-all duration-500 ${animClass}`}
      >
        <img
          src={spriteUrl}
          alt={getCharacterName(charId)}
          className="h-[70%] max-h-[400px] object-contain drop-shadow-2xl"
          style={{ filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.5))' }}
        />
      </div>
    )
  }

  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (!videoRef.current || currentNode?.type !== 'cg') return
    const d = currentNode.data as any
    if (d.mediaType !== 'video') return

    const video = videoRef.current

    const handleLoadedMetadata = () => {
      if (d.startTime && d.startTime > 0) {
        video.currentTime = d.startTime
      }
      if (d.playbackRate && d.playbackRate !== 1) {
        video.playbackRate = d.playbackRate
      }
    }

    const handleTimeUpdate = () => {
      if (d.endTime && d.endTime > 0 && video.currentTime >= d.endTime) {
        if (d.loop) {
          video.currentTime = d.loopStartTime || d.startTime || 0
        } else {
          video.pause()
          if (d.duration !== undefined && d.duration !== 0) {
            goNext()
          }
        }
      }
      if (d.loop && d.loopEndTime && video.currentTime >= d.loopEndTime) {
        video.currentTime = d.loopStartTime || d.startTime || 0
      }
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [currentNode, goNext, isMuted])

  const getDialoguePositionStyle = (visual: any): React.CSSProperties => {
    if (!visual) return {}
    const style: React.CSSProperties = {}
    const pos = visual.position || 'bottom'

    if (pos === 'top') {
      style.top = '1rem'
      style.bottom = 'auto'
    } else if (pos === 'center') {
      style.top = '50%'
      style.bottom = 'auto'
      style.transform = 'translateY(-50%)'
    } else if (pos === 'custom') {
      style.top = 'auto'
      style.bottom = 'auto'
      if (visual.customY !== undefined) {
        style.top = `${visual.customY}%`
      } else {
        style.bottom = '1rem'
      }
      if (visual.customX !== undefined) {
        style.left = '50%'
        style.transform = `translateX(calc(-50% + ${visual.customX}px))`
      }
    } else {
      style.bottom = '1rem'
    }

    if (visual.opacity !== undefined) {
      style.opacity = visual.opacity
    }

    return style
  }

  const getDialogueBoxStyle = (visual: any, baseColor?: string): React.CSSProperties => {
    if (!visual) return {}
    const style: React.CSSProperties = {}

    if (visual.width) style.width = `${visual.width}%`
    if (visual.maxWidth) style.maxWidth = `${visual.maxWidth}px`
    if (visual.borderRadius !== undefined) style.borderRadius = `${visual.borderRadius}px`
    if (visual.backgroundColor) style.backgroundColor = visual.backgroundColor
    if (visual.borderWidth !== undefined) style.borderWidth = `${visual.borderWidth}px`
    if (visual.borderColor) style.borderColor = visual.borderColor
    if (visual.shadow) style.boxShadow = '0 20px 60px rgba(0,0,0,0.5)'
    if (visual.backdropBlur === false) {
      style.backdropFilter = 'none'
      ;(style as any).WebkitBackdropFilter = 'none'
    }
    if (baseColor) {
      style.borderTopColor = baseColor
      style.borderTopWidth = '3px'
    }
    if (visual.paddingX !== undefined || visual.paddingY !== undefined) {
      style.padding = `${visual.paddingY || 20}px ${visual.paddingX || 20}px`
    }

    return style
  }

  const renderDialogueBox = () => {
    if (!currentNode) return null

    if (currentNode.type === 'dialogue') {
      const charId = (currentNode.data as any)?.characterId
      const name = getCharacterName(charId)
      const color = getCharacterColor(charId)
      const avatar = getCharacterAvatar(charId)
      const visual = (currentNode.data as any)?.visualStyle

      const positionStyle = getDialoguePositionStyle(visual)
      const boxStyle = getDialogueBoxStyle(visual, color)
      const showAvatar = visual?.showAvatar !== false
      const avatarSize = visual?.avatarSize || 40
      const textAlignment = visual?.textAlignment || 'left'
      const fontSize = visual?.fontSize ? `${visual.fontSize}px` : 'base'
      const fontColor = visual?.fontColor || 'white'
      const lineHeight = visual?.lineHeight || 'relaxed'
      const namePos = visual?.characterNamePosition || 'top'

      return (
        <div className="absolute left-0 right-0 px-4 flex justify-center" style={positionStyle}>
          <div
            className="bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden w-full max-w-2xl"
            style={boxStyle}
          >
            <div className={`flex items-center gap-3 px-5 pt-4 pb-2 ${namePos === 'hidden' ? 'hidden' : ''}`}>
              {showAvatar && (
                <img
                  src={avatar}
                  alt={name}
                  className="rounded-full border-2 object-cover"
                  style={{ width: `${avatarSize}px`, height: `${avatarSize}px`, borderColor: color }}
                />
              )}
              <span className="font-bold text-white text-sm">{name}</span>
              {(currentNode.data as any)?.emotion && (
                <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                  {(currentNode.data as any).emotion}
                </span>
              )}
            </div>
            <div className="px-5 pb-5 pt-1">
              <p
                className={`text-white ${fontSizeClass[fontSize] || 'text-base'} ${lineHeightClass[lineHeight] || 'leading-relaxed'} min-h-[3rem]`}
                style={{
                  color: fontColor,
                  textAlign: textAlignment as any,
                  fontSize: typeof fontSize === 'string' && fontSize.endsWith('px') ? fontSize : undefined,
                }}
              >
                {displayText}
                {isTyping && <span className="inline-block w-2 h-4 bg-pink-500 ml-1 animate-pulse" />}
              </p>
            </div>
            <div className="absolute bottom-2 right-4 text-xs text-slate-500">
              点击继续 ▼
            </div>
          </div>
        </div>
      )
    }

    if (currentNode.type === 'narration') {
      const visual = (currentNode.data as any)?.visualStyle
      const positionStyle = getDialoguePositionStyle(visual)
      const boxStyle = getDialogueBoxStyle(visual)
      const fontSize = visual?.fontSize ? `${visual.fontSize}px` : 'base'
      const fontColor = visual?.fontColor || '#e2e8f0'
      const textAlignment = visual?.textAlignment || 'center'
      const italic = visual?.italic !== false

      return (
        <div className="absolute left-0 right-0 px-4 flex justify-center" style={positionStyle}>
          <div
            className="bg-black/80 backdrop-blur-md rounded-2xl border border-slate-600 shadow-2xl px-6 py-5 w-full max-w-2xl"
            style={{
              ...boxStyle,
              backgroundColor: visual?.backgroundColor || 'rgba(0,0,0,0.8)',
            }}
          >
            <p
              className={`text-slate-200 ${fontSizeClass[fontSize] || 'text-base'} leading-relaxed text-center ${italic ? 'italic' : ''} min-h-[3rem]`}
              style={{
                color: fontColor,
                textAlign: textAlignment as any,
                fontSize: typeof fontSize === 'string' && fontSize.endsWith('px') ? fontSize : undefined,
              }}
            >
              {displayText}
              {isTyping && <span className="inline-block w-2 h-4 bg-slate-400 ml-1 animate-pulse" />}
            </p>
          </div>
        </div>
      )
    }

    if (currentNode.type === 'choice') {
      const options = (currentNode.data as any)?.options || []
      const prompt = (currentNode.data as any)?.prompt || '你的选择是？'
      const visual = (currentNode.data as any)?.visualStyle
      const choiceMode = (currentNode.data as any)?.choiceMode || 'text'

      const positionStyle = getDialoguePositionStyle(visual)
      const boxStyle = getDialogueBoxStyle(visual)
      const promptPosition = visual?.promptPosition || 'top'
      const promptText = visual?.promptText || prompt

      // 场景选择模式：渲染可点击的拼图场景图层
      if (choiceMode === 'scene') {
        const sceneId = (currentNode.data as any)?.sceneId
        const scene = sceneId ? scenes.find((s) => s.id === sceneId) : null

        if (!scene || !scene.puzzleData) {
          return (
            <div className="absolute left-0 right-0 px-4 flex justify-center" style={positionStyle}>
              <div
                className="bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl p-5 w-full max-w-2xl"
                style={boxStyle}
              >
                <p className="text-center text-slate-300 text-sm mb-4">{promptText}</p>
                <p className="text-center text-slate-500 text-sm py-6">未找到场景数据</p>
              </div>
            </div>
          )
        }

        const sortedLayers = [...scene.puzzleData.layers].sort((a, b) => a.zIndex - b.zIndex)

        return (
          <div className="absolute inset-0 z-10">
            <div className="absolute top-4 left-0 right-0 px-4 flex justify-center z-20 pointer-events-none">
              <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700 shadow-2xl px-4 py-2">
                <p className="text-center text-slate-200 text-sm">{promptText}</p>
              </div>
            </div>
            <div className="absolute inset-0">
              {sortedLayers.map((layer: any) => {
                if (!layer.visible) return null

                const matchingOption = options.find((o: any) => o.clickableLayerId === layer.id)
                const isClickable = layer.clickable === true || !!matchingOption
                const isBg = layer.type === 'background'

                const layerStyle: React.CSSProperties = isBg
                  ? { position: 'absolute', inset: 0, zIndex: layer.zIndex, opacity: layer.opacity }
                  : {
                      position: 'absolute',
                      left: `${layer.x}%`,
                      top: `${layer.y}%`,
                      width: layer.width ? `${layer.width}%` : 'auto',
                      height: layer.height ? `${layer.height}%` : 'auto',
                      transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
                      transformOrigin: 'center center',
                      zIndex: layer.zIndex,
                      opacity: layer.opacity,
                    }

                const hoverEffect = layer.hoverEffect || 'none'
                const hoverClass = isClickable
                  ? hoverEffect === 'highlight'
                    ? 'hover:brightness-125 transition-all'
                    : hoverEffect === 'scale'
                      ? 'hover:scale-105 transition-transform'
                      : hoverEffect === 'glow'
                        ? 'hover:drop-shadow-[0_0_15px_rgba(236,72,153,0.8)] transition-all'
                        : 'transition-all'
                  : ''

                if (layer.type === 'text') {
                  return (
                    <div key={layer.id} style={layerStyle} className={hoverClass}>
                      <div
                        style={{
                          fontSize: layer.fontSize || 16,
                          color: layer.fontColor || '#ffffff',
                          whiteSpace: 'pre-wrap',
                          textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                        }}
                      >
                        {layer.textContent || ''}
                      </div>
                    </div>
                  )
                }

                const imageUrl =
                  layer.type === 'character' && layer.characterId
                    ? (() => {
                        const char = characters.find((c) => c.id === layer.characterId)
                        const sprite = char?.sprites?.find((s) => s.emotion === layer.emotion)
                        return sprite?.url || sprite?.image || layer.url
                      })()
                    : layer.url

                return (
                  <div
                    key={layer.id}
                    className={`${isClickable ? 'cursor-pointer' : ''} ${hoverClass}`}
                    style={layerStyle}
                    onClick={isClickable && matchingOption ? () => handleChoice(matchingOption) : undefined}
                  >
                    <img
                      src={imageUrl}
                      alt={layer.name}
                      className={isBg ? 'w-full h-full object-cover' : 'max-w-full max-h-full object-contain'}
                      draggable={false}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      }

      // 图片选择模式：渲染为图片卡片网格
      if (choiceMode === 'image') {
        return (
          <div className="absolute left-0 right-0 px-4 flex justify-center" style={positionStyle}>
            <div
              className="bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl p-5 w-full max-w-2xl"
              style={boxStyle}
            >
              {promptPosition === 'top' && (
                <p className="text-center text-slate-300 text-sm mb-4">{promptText}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                {options.map((opt: any, idx: number) => {
                  const imagePosition = opt.imagePosition || 'top'
                  const img = opt.image

                  if (imagePosition === 'background') {
                    return (
                      <button
                        key={opt.id || idx}
                        onClick={() => handleChoice(opt)}
                        className="relative rounded-xl border border-slate-700 overflow-hidden hover:border-pink-500 transition-all aspect-video"
                      >
                        {img && (
                          <img src={img} alt={opt.text} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                        )}
                        <div className="absolute inset-0 bg-black/40" />
                        <div className="absolute inset-0 flex items-center justify-center p-3">
                          <span className="text-white font-bold text-sm drop-shadow-lg text-center">{opt.text}</span>
                        </div>
                      </button>
                    )
                  }

                  if (imagePosition === 'left') {
                    return (
                      <button
                        key={opt.id || idx}
                        onClick={() => handleChoice(opt)}
                        className="flex w-full rounded-xl border border-slate-700 overflow-hidden hover:border-pink-500 transition-all"
                      >
                        {img && (
                          <div className="w-1/3 relative bg-slate-800">
                            <img src={img} alt={opt.text} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                          </div>
                        )}
                        <div className="w-2/3 flex items-center p-3 bg-slate-800/80">
                          <span className="text-white text-sm text-left">{opt.text}</span>
                        </div>
                      </button>
                    )
                  }

                  // 默认 'top'：图片在上，文字在下
                  return (
                    <button
                      key={opt.id || idx}
                      onClick={() => handleChoice(opt)}
                      className="rounded-xl border border-slate-700 overflow-hidden hover:border-pink-500 transition-all text-left"
                    >
                      {img && (
                        <div className="aspect-video w-full overflow-hidden bg-slate-800">
                          <img src={img} alt={opt.text} className="w-full h-full object-cover" draggable={false} />
                        </div>
                      )}
                      <div className="p-3 bg-slate-800/80">
                        <span className="text-white text-sm">{opt.text}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
              {promptPosition === 'bottom' && (
                <p className="text-center text-slate-300 text-sm mt-4">{promptText}</p>
              )}
            </div>
          </div>
        )
      }

      // 文本选择模式（默认，保持原有渲染）
      const showLetter = visual?.showLetter !== false
      const optionHeight = visual?.optionHeight ? `${visual.optionHeight}px` : 'auto'
      const optionFontSize = visual?.optionFontSize ? `${visual.optionFontSize}px` : 'sm'
      const optionTextColor = visual?.optionTextColor || 'white'
      const optionBgColor = visual?.optionBgColor || 'rgba(30, 41, 59, 0.8)'
      const optionHoverBgColor = visual?.optionHoverBgColor || 'rgba(236, 72, 153, 0.2)'
      const optionBorderColor = visual?.optionBorderColor || '#475569'
      const optionHoverBorderColor = visual?.optionHoverBorderColor || '#ec4899'
      const optionAlignment = visual?.optionAlignment || 'left'
      const gap = visual?.gap !== undefined ? `${visual.gap}px` : '0.5rem'

      return (
        <div className="absolute left-0 right-0 px-4 flex justify-center" style={positionStyle}>
          <div
            className="bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl p-5 w-full max-w-2xl"
            style={boxStyle}
          >
            {promptPosition === 'top' && (
              <p className="text-center text-slate-300 text-sm mb-4">{promptText}</p>
            )}
            <div className="space-y-2" style={{ gap }}>
              {options.map((opt: any, idx: number) => (
                <button
                  key={opt.id || idx}
                  onClick={() => handleChoice(opt)}
                  className="w-full text-left px-4 py-3 rounded-xl border transition-all group"
                  style={{
                    height: optionHeight,
                    fontSize: typeof optionFontSize === 'string' && optionFontSize.endsWith('px') ? optionFontSize : undefined,
                    color: optionTextColor,
                    backgroundColor: optionBgColor,
                    borderColor: optionBorderColor,
                    textAlign: optionAlignment as any,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = optionHoverBgColor
                    e.currentTarget.style.borderColor = optionHoverBorderColor
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = optionBgColor
                    e.currentTarget.style.borderColor = optionBorderColor
                  }}
                >
                  {showLetter && (
                    <span className="text-pink-400 font-bold mr-2">{String.fromCharCode(65 + idx)}.</span>
                  )}
                  {opt.text}
                </button>
              ))}
            </div>
            {promptPosition === 'bottom' && (
              <p className="text-center text-slate-300 text-sm mt-4">{promptText}</p>
            )}
          </div>
        </div>
      )
    }

    if (currentNode.type === 'cg') {
      const d = currentNode.data as any
      const isVideo = d.mediaType === 'video'
      const hasLetterbox = d.letterbox !== false
      const displayMode: 'contain' | 'cover' | 'fill' | 'custom' = d.displayMode || 'contain'
      const objectPosition: string = d.objectPosition || 'center'

      const hasTransform = d.x !== undefined || d.y !== undefined || d.opacity !== undefined || d.rotation !== undefined

      const cgContainerStyle: React.CSSProperties = {
        backgroundColor: d.fillColor || '#000',
      }

      const mediaWrapperStyle: React.CSSProperties = {}
      if (hasTransform) {
        if (d.x !== undefined) mediaWrapperStyle.left = `calc(50% + ${d.x}px)`
        if (d.y !== undefined) mediaWrapperStyle.top = `calc(50% + ${d.y}px)`
        if (d.opacity !== undefined) mediaWrapperStyle.opacity = d.opacity
        if (d.rotation !== undefined) mediaWrapperStyle.transform = `translate(-50%, -50%) rotate(${d.rotation}deg)`
        mediaWrapperStyle.position = 'absolute'
      }

      const isCustom = displayMode === 'custom'
      const mediaClassName = isCustom
        ? 'object-contain'
        : displayMode === 'cover'
          ? 'w-full h-full object-cover'
          : displayMode === 'fill'
            ? 'w-full h-full object-fill'
            : 'w-full h-full object-contain'

      const mediaStyle: React.CSSProperties = isCustom
        ? {
            width: `${d.customWidth || 100}%`,
            height: `${d.customHeight || 100}%`,
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            objectPosition,
            borderRadius: d.borderRadius ? `${d.borderRadius}px` : undefined,
            borderWidth: d.borderWidth ? `${d.borderWidth}px` : undefined,
            borderColor: d.borderColor || undefined,
            borderStyle: d.borderWidth ? 'solid' : undefined,
            boxShadow: d.shadow ? '0 20px 60px rgba(0,0,0,0.6)' : undefined,
          }
        : {
            objectPosition,
            borderRadius: d.borderRadius ? `${d.borderRadius}px` : undefined,
            borderWidth: d.borderWidth ? `${d.borderWidth}px` : undefined,
            borderColor: d.borderColor || undefined,
            borderStyle: d.borderWidth ? 'solid' : undefined,
            boxShadow: d.shadow ? '0 20px 60px rgba(0,0,0,0.6)' : undefined,
          }

      return (
        <div className="absolute inset-0 z-10" style={cgContainerStyle}>
          <div style={hasTransform ? mediaWrapperStyle : {}} className={hasTransform ? '' : 'w-full h-full'}>
            {isVideo ? (
              <video
                ref={videoRef}
                src={d.url}
                className={mediaClassName}
                style={mediaStyle}
                autoPlay
                muted={d.muted !== undefined ? d.muted : isMuted}
                loop={d.loop || false}
                playsInline
                controls={d.showControls || false}
                onEnded={() => {
                  if (d.duration === 0) return
                  if (!d.loop) goNext()
                }}
              />
            ) : (
              d.url && (
                <img
                  src={d.url}
                  alt={d.title || 'CG'}
                  className={mediaClassName}
                  style={mediaStyle}
                />
              )
            )}
          </div>

          {d.overlayLayers && d.overlayLayers.length > 0 && (
            d.overlayLayers.map((layer: any) => (
              <img
                key={layer.id}
                src={layer.url}
                alt={layer.name || ''}
                draggable={false}
                className="absolute pointer-events-none"
                style={{
                  left: `${layer.x}%`,
                  top: `${layer.y}%`,
                  width: `${layer.width}%`,
                  height: layer.height ? `${layer.height}%` : 'auto',
                  transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
                  opacity: layer.opacity,
                  zIndex: layer.zIndex,
                }}
              />
            ))
          )}

          {hasLetterbox && (
            <>
              <div className="absolute top-0 left-0 right-0 h-[8%] bg-black pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 h-[8%] bg-black pointer-events-none" />
            </>
          )}

          {(d.title || d.subtitle) && (
            <div className="absolute bottom-[12%] left-0 right-0 text-center px-6 pointer-events-none">
              {d.title && (
                <h3 className="text-white text-xl font-bold drop-shadow-lg mb-1">
                  {d.title}
                </h3>
              )}
              {d.subtitle && (
                <p className="text-white/80 text-sm drop-shadow">{d.subtitle}</p>
              )}
            </div>
          )}

          {d.canSkip !== false && d.duration === 0 && (
            <div className="absolute bottom-3 right-4 text-xs text-white/60 pointer-events-none">
              点击继续 ▼
            </div>
          )}

          {d.canSkip === false && (
            <div className="absolute bottom-3 right-4 text-xs text-white/40 pointer-events-none">
              不可跳过
            </div>
          )}
        </div>
      )
    }

    if (currentNode.type === 'ending') {
      const endingType = (currentNode.data as any)?.endingType || 'neutral'
      const title = (currentNode.data as any)?.title || '结局'
      const text = (currentNode.data as any)?.text || ''
      const coverImage = (currentNode.data as any)?.coverImage

      const typeConfig: Record<string, { emoji: string; color: string; label: string }> = {
        good: { emoji: '🌟', color: '#fbbf24', label: '好结局' },
        bad: { emoji: '💀', color: '#ef4444', label: '坏结局' },
        neutral: { emoji: '📖', color: '#6b7280', label: '普通结局' },
        secret: { emoji: '🔮', color: '#a855f7', label: '隐藏结局' },
      }

      const config = typeConfig[endingType] || typeConfig.neutral

      return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          {coverImage && (
            <img
              src={coverImage}
              alt="结局封面"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {coverImage && <div className="absolute inset-0 bg-black/50" />}
          <div
            className="bg-slate-900/95 backdrop-blur-md rounded-2xl border shadow-2xl p-8 max-w-md mx-4 text-center relative z-10"
            style={{ borderColor: config.color }}
          >
            <div className="text-5xl mb-4">{config.emoji}</div>
            <div className="text-xs font-bold tracking-widest mb-2" style={{ color: config.color }}>
              {config.label}
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">{title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{text}</p>
          </div>
        </div>
      )
    }

    return null
  }

  const puzzleScene = getCurrentPuzzleScene()

  const getBackgroundImage = useCallback((): string => {
    const sceneId = (currentNode?.data as any)?.sceneId
    if (sceneId) {
      const scene = scenes.find((s) => s.id === sceneId)
      if (scene?.backgroundImage) return scene.backgroundImage
    }
    const nodeBg = (currentNode?.data as any)?.backgroundImage
    if (nodeBg) return nodeBg
    return getCurrentScene()
  }, [currentNode, scenes, getCurrentScene])

  return (
    <div className={`flex flex-col h-full bg-slate-950 ${className}`}>
      <div
        className="relative flex-1 overflow-hidden cursor-pointer group"
        onClick={handleSceneClick}
        style={!puzzleScene ? {
          backgroundImage: `url(${getBackgroundImage()})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : undefined}
      >
        {puzzleScene && puzzleScene.puzzleData && (
          <div className="absolute inset-0">
            <RuntimeSceneRenderer
              scene={puzzleScene.puzzleData}
              characters={characters}
              className="w-full h-full"
            />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

        {sceneTransition && (
          <div className="absolute inset-0 bg-black animate-fade z-20 pointer-events-none" />
        )}

        {renderCharacter()}

        {renderDialogueBox()}

        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="ghost" className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white">
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="bg-slate-900 border-t border-slate-800 px-3 py-2">
        <div className="flex items-center gap-2 mb-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={goPrev}
            disabled={!dialogueNodes.length || currentIndex === 0}
          >
            <SkipBack className="w-3.5 h-3.5" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white hover:bg-slate-800 bg-pink-500/20 hover:bg-pink-500/30"
            onClick={togglePlay}
          >
            {isPlaying ? <Pause className="w-4 h-4 text-pink-400" /> : <Play className="w-4 h-4 text-pink-400" />}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={goNext}
            disabled={!dialogueNodes.length || currentIndex >= dialogueNodes.length - 1}
          >
            <SkipForward className="w-3.5 h-3.5" />
          </Button>

          <div className="flex-1" />

          <span className="text-xs text-slate-500 min-w-[60px] text-center">
            {dialogueNodes.length > 0 ? `${currentIndex + 1}/${dialogueNodes.length}` : '0/0'}
          </span>

          <div className="flex-1" />

          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={() => setIsMuted(!isMuted)}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </Button>
        </div>

        {dialogueNodes.length > 0 && (
          <div className="px-1">
            <input
              type="range"
              min={0}
              max={dialogueNodes.length - 1}
              value={currentIndex}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                setCurrentIndex(val)
                setCharacterEntering(true)
                setTimeout(() => { if (mountedRef.current) setCharacterEntering(false) }, 500)
              }}
              className="w-full h-1 accent-pink-500 cursor-pointer"
            />
          </div>
        )}
      </div>
    </div>
  )
}

function areLivePreviewPropsEqual(prev: LivePreviewProps, next: LivePreviewProps) {
  return prev.nodes === next.nodes &&
         prev.characters === next.characters &&
         prev.scenes === next.scenes &&
         prev.audios === next.audios &&
         prev.selectedNodeId === next.selectedNodeId
}

export const MemoizedLivePreview = memo(LivePreview, areLivePreviewPropsEqual)
export { LivePreview }
export default MemoizedLivePreview

'use client'

import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2 } from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import { RuntimeSceneRenderer } from './puzzle/runtime-scene-renderer'
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
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const dialogueNodes = useMemo(() => {
    return nodes.filter((n) => n.type === 'dialogue' || n.type === 'choice' || n.type === 'narration' || n.type === 'ending' || n.type === 'cg')
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
      delay = d.duration && d.duration > 0 ? d.duration : 3000
    } else {
      const text = (currentNode.data as any)?.text || ''
      delay = Math.max(1500, text.length * 60)
    }

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
      setTimeout(() => setCharacterEntering(false), 500)
    }
  }, [currentIndex])

  const goNext = useCallback(() => {
    if (currentIndex < dialogueNodes.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setCharacterEntering(true)
      setTimeout(() => setCharacterEntering(false), 500)
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
    if (isTyping) {
      const text = (currentNode?.data as any)?.text || ''
      setDisplayText(text)
      setIsTyping(false)
    } else {
      goNext()
    }
  }

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

  const renderDialogueBox = () => {
    if (!currentNode) return null

    if (currentNode.type === 'dialogue') {
      const charId = (currentNode.data as any)?.characterId
      const name = getCharacterName(charId)
      const color = getCharacterColor(charId)
      const avatar = getCharacterAvatar(charId)

      return (
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div
            className="bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden"
            style={{ borderTopColor: color, borderTopWidth: '3px' }}
          >
            <div className="flex items-center gap-3 px-5 pt-4 pb-2">
              <img src={avatar} alt={name} className="w-10 h-10 rounded-full border-2 object-cover" style={{ borderColor: color }} />
              <span className="font-bold text-white text-sm">{name}</span>
              {(currentNode.data as any)?.emotion && (
                <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                  {(currentNode.data as any).emotion}
                </span>
              )}
            </div>
            <div className="px-5 pb-5 pt-1">
              <p className="text-white text-base leading-relaxed min-h-[3rem]">
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
      return (
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="bg-black/80 backdrop-blur-md rounded-2xl border border-slate-600 shadow-2xl px-6 py-5">
            <p className="text-slate-200 text-base leading-relaxed text-center italic min-h-[3rem]">
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

      return (
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl p-5">
            <p className="text-center text-slate-300 text-sm mb-4">{prompt}</p>
            <div className="space-y-2">
              {options.map((opt: any, idx: number) => (
                <button
                  key={opt.id || idx}
                  className="w-full text-left px-4 py-3 rounded-xl bg-slate-800/80 hover:bg-pink-500/20 border border-slate-600 hover:border-pink-500 text-white text-sm transition-all group"
                >
                  <span className="text-pink-400 font-bold mr-2">{String.fromCharCode(65 + idx)}.</span>
                  {opt.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )
    }

    if (currentNode.type === 'cg') {
      const d = currentNode.data as any
      const isVideo = d.mediaType === 'video'
      const hasLetterbox = d.letterbox !== false

      return (
        <div className="absolute inset-0 z-10 bg-black">
          {isVideo ? (
            <video
              src={d.url}
              className="w-full h-full object-contain"
              autoPlay
              muted={isMuted}
              loop={false}
              playsInline
              onEnded={() => {
                if (d.duration === 0) return
                goNext()
              }}
            />
          ) : (
            d.url && (
              <img
                src={d.url}
                alt={d.title || 'CG'}
                className="w-full h-full object-contain"
              />
            )
          )}

          {hasLetterbox && (
            <>
              <div className="absolute top-0 left-0 right-0 h-[8%] bg-black" />
              <div className="absolute bottom-0 left-0 right-0 h-[8%] bg-black" />
            </>
          )}

          {(d.title || d.subtitle) && (
            <div className="absolute bottom-[12%] left-0 right-0 text-center px-6">
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
            <div className="absolute bottom-3 right-4 text-xs text-white/60">
              点击继续 ▼
            </div>
          )}

          {d.canSkip === false && (
            <div className="absolute bottom-3 right-4 text-xs text-white/40">
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

      const typeConfig: Record<string, { emoji: string; color: string; label: string }> = {
        good: { emoji: '🌟', color: '#fbbf24', label: '好结局' },
        bad: { emoji: '💀', color: '#ef4444', label: '坏结局' },
        neutral: { emoji: '📖', color: '#6b7280', label: '普通结局' },
        secret: { emoji: '🔮', color: '#a855f7', label: '隐藏结局' },
      }

      const config = typeConfig[endingType] || typeConfig.neutral

      return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="bg-slate-900/95 backdrop-blur-md rounded-2xl border shadow-2xl p-8 max-w-md mx-4 text-center"
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
                setTimeout(() => setCharacterEntering(false), 500)
              }}
              className="w-full h-1 accent-pink-500 cursor-pointer"
            />
          </div>
        )}
      </div>
    </div>
  )
}

function areLivePreviewPropsEqual(
  prevProps: LivePreviewProps,
  nextProps: LivePreviewProps
): boolean {
  if (prevProps.selectedNodeId !== nextProps.selectedNodeId) return false
  if (prevProps.nodes.length !== nextProps.nodes.length) return false
  if (prevProps.characters.length !== nextProps.characters.length) return false
  if (prevProps.scenes?.length !== nextProps.scenes?.length) return false
  if (prevProps.audios?.length !== nextProps.audios?.length) return false
  return true
}

export const MemoizedLivePreview = memo(LivePreview, areLivePreviewPropsEqual)
export { LivePreview }
export default MemoizedLivePreview

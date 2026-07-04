'use client'

import { useState, useEffect, memo } from 'react'
import type { PuzzleScene, PuzzleLayer, StoryCharacter } from '@editor/types/editor'

interface RuntimeSceneRendererProps {
  scene: PuzzleScene
  characters?: StoryCharacter[]
  className?: string
  animate?: boolean
}

export function RuntimeSceneRenderer({
  scene,
  characters = [],
  className = '',
  animate = true,
}: RuntimeSceneRendererProps) {
  const sortedLayers = [...scene.layers].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div
      className={`relative w-full h-full overflow-hidden ${className}`}
      style={{ aspectRatio: `${scene.width}/${scene.height}` }}
    >
      {sortedLayers.map((layer) => (
        <AnimatedLayer key={layer.id} layer={layer} characters={characters} animate={animate} />
      ))}
    </div>
  )
}

function AnimatedLayer({
  layer,
  characters,
  animate,
}: {
  layer: PuzzleLayer
  characters: StoryCharacter[]
  animate: boolean
}) {
  const [entered, setEntered] = useState(!animate)

  useEffect(() => {
    if (!animate) {
      setEntered(true)
      return
    }
    if (layer.animation?.type === 'none' || !layer.animation?.type) {
      setEntered(true)
      return
    }
    const timer = setTimeout(() => setEntered(true), layer.animation?.delay || 0)
    return () => clearTimeout(timer)
  }, [layer.id, layer.animation, animate])

  if (!layer.visible) return null

  const isBg = layer.type === 'background'

  const getImageUrl = () => {
    if (layer.type === 'character' && layer.characterId) {
      const char = characters.find((c) => c.id === layer.characterId)
      const sprite = char?.sprites?.find((s) => s.emotion === layer.emotion)
      return sprite?.url || sprite?.image || layer.url
    }
    return layer.url
  }

  const animType = layer.animation?.type || 'none'
  const animDuration = layer.animation?.duration || 300

  const animClass = entered
    ? animType === 'fade-in'
      ? 'animate-fade-in'
      : animType === 'slide-left'
        ? 'animate-slide-in-left'
        : animType === 'slide-right'
          ? 'animate-slide-in-right'
          : animType === 'slide-up'
            ? 'animate-slide-in-up'
            : animType === 'slide-down'
              ? 'animate-slide-in-down'
              : animType === 'zoom-in'
                ? 'animate-zoom-in'
                : animType === 'bounce'
                  ? 'animate-bounce-in'
                  : ''
    : 'opacity-0'

  const style: React.CSSProperties = isBg
    ? {
        position: 'absolute',
        inset: 0,
        zIndex: layer.zIndex,
        opacity: layer.opacity,
        animationDuration: `${animDuration}ms`,
      }
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
        animationDuration: `${animDuration}ms`,
      }

  if (layer.type === 'text') {
    return (
      <div style={style} className={animClass}>
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

  if (layer.type === 'effect' && layer.url.endsWith('.mp4')) {
    return (
      <div style={style} className={animClass}>
        <video
          src={layer.url}
          className="w-full h-full object-contain"
          autoPlay
          loop
          muted
          playsInline
        />
      </div>
    )
  }

  return (
    <div style={style} className={animClass}>
      <img
        src={getImageUrl()}
        alt={layer.name}
        className={isBg ? 'w-full h-full object-cover' : 'max-w-full max-h-full object-contain'}
        draggable={false}
      />
    </div>
  )
}

export default memo(RuntimeSceneRenderer)

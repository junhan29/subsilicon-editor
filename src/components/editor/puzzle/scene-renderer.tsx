'use client'

import { memo } from 'react'
import type { PuzzleLayer, PuzzleScene } from '@editor/types/editor'

interface SceneRendererProps {
  scene: PuzzleScene
  selectedLayerId?: string | null
  onLayerClick?: (layerId: string) => void
  interactive?: boolean
  className?: string
}

export function SceneRenderer({
  scene,
  selectedLayerId,
  onLayerClick,
  interactive = false,
  className = '',
}: SceneRendererProps) {
  const sortedLayers = [...scene.layers].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div
      className={`relative w-full h-full overflow-hidden ${className}`}
      style={{ aspectRatio: `${scene.width}/${scene.height}` }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onLayerClick) {
          onLayerClick('')
        }
      }}
    >
      {sortedLayers.map((layer) => (
        <LayerView
          key={layer.id}
          layer={layer}
          sceneWidth={scene.width}
          sceneHeight={scene.height}
          selected={selectedLayerId === layer.id}
          onClick={() => onLayerClick?.(layer.id)}
          interactive={interactive}
        />
      ))}
    </div>
  )
}

function LayerView({
  layer,
  sceneWidth,
  sceneHeight,
  selected,
  onClick,
  interactive,
}: {
  layer: PuzzleLayer
  sceneWidth: number
  sceneHeight: number
  selected: boolean
  onClick: () => void
  interactive: boolean
}) {
  if (!layer.visible) return null

  const isBg = layer.type === 'background'

  const style: React.CSSProperties = isBg
    ? {
        position: 'absolute',
        inset: 0,
        zIndex: layer.zIndex,
        opacity: layer.opacity,
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
        cursor: interactive ? 'pointer' : 'default',
      }

  const renderContent = () => {
    if (layer.type === 'text') {
      return (
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
      )
    }

    if (layer.type === 'effect' && layer.url.endsWith('.mp4')) {
      return (
        <video
          src={layer.url}
          className="w-full h-full object-contain"
          autoPlay
          loop
          muted
          playsInline
        />
      )
    }

    return (
      <img
        src={layer.url}
        alt={layer.name}
        className={isBg ? 'w-full h-full object-cover' : 'max-w-full max-h-full object-contain select-none pointer-events-none'}
        draggable={false}
      />
    )
  }

  if (!interactive) {
    return <div style={style}>{renderContent()}</div>
  }

  return (
    <div
      style={style}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={selected ? 'ring-2 ring-pink-500 ring-offset-2 ring-offset-transparent' : ''}
    >
      {renderContent()}
    </div>
  )
}
export default memo(SceneRenderer)

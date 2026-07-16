'use client'

import { useState, memo, useRef, useCallback, useEffect } from 'react'
import { ZoomIn, ZoomOut, Maximize2, RotateCw } from 'lucide-react'
import type { PuzzleLayer, PuzzleScene } from '@editor/types/editor'
import { SceneRenderer } from './scene-renderer'

interface PuzzleCanvasProps {
  scene: PuzzleScene
  selectedLayerId: string | null
  onSelectLayer: (id: string | null) => void
  onUpdateLayer: (id: string, updates: Partial<PuzzleLayer>) => void
  onDropLayer: (type: string, data: any, xPercent: number, yPercent: number) => void
}

export function PuzzleCanvas({
  scene,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onDropLayer,
}: PuzzleCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(100)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, layerX: 0, layerY: 0 })
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const xPercent = (x / rect.width) * 100
    const yPercent = (y / rect.height) * 100

    try {
      const raw = e.dataTransfer.getData('application/json')
      if (raw) {
        const { type, data } = JSON.parse(raw)
        onDropLayer(type, data, xPercent, yPercent)
      }
    } catch {
      // ignore
    }
  }, [onDropLayer])

  const handleLayerMouseDown = useCallback((e: React.MouseEvent, layerId: string) => {
    e.stopPropagation()
    const layer = scene.layers.find((l) => l.id === layerId)
    if (!layer || layer.type === 'background') return

    setIsDragging(true)
    onSelectLayer(layerId)
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      layerX: layer.x,
      layerY: layer.y,
    })
  }, [scene.layers, onSelectLayer])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect || !selectedLayerId) return

      const scale = zoom / 100
      const dx = ((e.clientX - dragStart.x) / (rect.width * scale)) * 100
      const dy = ((e.clientY - dragStart.y) / (rect.height * scale)) * 100

      onUpdateLayer(selectedLayerId, {
        x: Math.max(0, Math.min(100, dragStart.layerX + dx)),
        y: Math.max(0, Math.min(100, dragStart.layerY + dy)),
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStart, selectedLayerId, onUpdateLayer, zoom])

  const selectedLayer = scene.layers.find((l) => l.id === selectedLayerId)

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(25, z - 25))}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-400 min-w-[50px] text-center">{zoom}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(200, z + 25))}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(100)}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors ml-1"
            title="1:1"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-[10px] text-slate-500">
          {scene.width} × {scene.height}
        </div>
      </div>

      <div
        ref={canvasRef}
        className={`flex-1 flex items-center justify-center overflow-auto p-8 transition-colors ${
          isDragOver ? 'bg-pink-500/10' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => onSelectLayer(null)}
      >
        <div
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'center center',
            width: '100%',
            maxWidth: scene.width * 0.8,
          }}
          className="shadow-2xl"
        >
          <div
            className="relative bg-slate-800 rounded overflow-hidden"
            style={{
              aspectRatio: `${scene.width}/${scene.height}`,
              backgroundImage: 'linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
            }}
          >
            {scene.layers
              .filter((l) => l.type === 'background')
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((layer) => (
                <div
                  key={layer.id}
                  className={`absolute inset-0 cursor-pointer ${
                    selectedLayerId === layer.id ? 'ring-2 ring-pink-500 ring-inset' : ''
                  } ${layer.clickable ? 'border-2 border-dashed border-pink-500' : ''}`}
                  style={{ zIndex: layer.zIndex, opacity: layer.opacity }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectLayer(layer.id)
                  }}
                >
                  {layer.clickable && (
                    <div className="absolute -top-2 -right-2 z-10 px-1 py-0.5 text-[9px] font-medium text-white bg-pink-500 rounded shadow-md pointer-events-none">
                      点击
                    </div>
                  )}
                  <img
                    src={layer.url}
                    alt={layer.name}
                    className="w-full h-full object-cover select-none pointer-events-none"
                    draggable={false}
                  />
                </div>
              ))}

            {scene.layers
              .filter((l) => l.type !== 'background')
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((layer) => (
                <div
                  key={layer.id}
                  className={`absolute cursor-move select-none ${
                    selectedLayerId === layer.id ? 'ring-2 ring-pink-500' : ''
                  } ${!layer.visible ? 'opacity-30' : ''} ${
                    layer.clickable ? 'border-2 border-dashed border-pink-500' : ''
                  }`}
                  style={{
                    left: `${layer.x}%`,
                    top: `${layer.y}%`,
                    width: layer.width ? `${layer.width}%` : 'auto',
                    height: layer.height ? `${layer.height}%` : 'auto',
                    transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
                    transformOrigin: 'center center',
                    zIndex: layer.zIndex,
                    opacity: layer.opacity,
                  }}
                  onMouseDown={(e) => handleLayerMouseDown(e, layer.id)}
                >
                  {layer.clickable && (
                    <div className="absolute -top-2 -right-2 z-10 px-1 py-0.5 text-[9px] font-medium text-white bg-pink-500 rounded shadow-md pointer-events-none">
                      点击
                    </div>
                  )}
                  {layer.type === 'text' ? (
                    <div
                      style={{
                        fontSize: layer.fontSize || 16,
                        color: layer.fontColor || '#ffffff',
                        whiteSpace: 'pre-wrap',
                        textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                        minWidth: '20px',
                        minHeight: '20px',
                      }}
                    >
                      {layer.textContent || '文字'}
                    </div>
                  ) : (
                    <img
                      src={layer.url}
                      alt={layer.name}
                      className="max-w-full max-h-full object-contain pointer-events-none"
                      draggable={false}
                    />
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>

      {selectedLayer && selectedLayer.type !== 'background' && (
        <div className="px-3 py-2 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">
            X: {selectedLayer.x.toFixed(1)}% · Y: {selectedLayer.y.toFixed(1)}% · W: {selectedLayer.width.toFixed(0)}%
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onUpdateLayer(selectedLayer.id, { rotation: (selectedLayer.rotation + 90) % 360 })}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="旋转90°"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(PuzzleCanvas)

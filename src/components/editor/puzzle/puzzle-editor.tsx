'use client'

import { useState, useCallback, useEffect } from 'react'
import { X, Check, ArrowLeft } from 'lucide-react'
import type { PuzzleScene, PuzzleLayer, ComicScene, StoryCharacter } from '@editor/types/editor'
import { AssetPanel } from './asset-panel'
import { PuzzleCanvas } from './puzzle-canvas'
import { LayerPanel } from './layer-panel'

interface PuzzleEditorProps {
  scene: ComicScene | null
  characters: StoryCharacter[]
  onClose: () => void
  onSave: (updatedScene: ComicScene) => void
}

function createEmptyPuzzle(name: string): PuzzleScene {
  const now = Date.now()
  return {
    id: `puzzle-${now}`,
    name,
    width: 1920,
    height: 1080,
    layers: [],
    createdAt: now,
    updatedAt: now,
  }
}

function createLayer(
  type: PuzzleLayer['type'],
  data: { name?: string; url?: string; characterId?: string; avatar?: string },
  x: number,
  y: number,
  zIndex: number,
): PuzzleLayer {
  const now = Date.now()
  const baseLayer: PuzzleLayer = {
    id: `layer-${now}-${Math.random().toString(36).slice(2, 7)}`,
    name: data.name || '图层',
    type,
    visible: true,
    x,
    y,
    width: type === 'background' ? 100 : type === 'character' ? 25 : 15,
    height: 0,
    rotation: 0,
    opacity: 1,
    zIndex,
    url: data.url || data.avatar || '',
  }

  if (type === 'character' && data.characterId) {
    baseLayer.characterId = data.characterId
    baseLayer.emotion = 'normal'
  }

  if (type === 'text') {
    baseLayer.textContent = '文字'
    baseLayer.fontSize = 24
    baseLayer.fontColor = '#ffffff'
  }

  return baseLayer
}

export function PuzzleEditor({ scene, characters, onClose, onSave }: PuzzleEditorProps) {
  const [puzzle, setPuzzle] = useState<PuzzleScene>(() => {
    if (scene?.puzzleData) return scene.puzzleData
    return createEmptyPuzzle(scene?.name || '新场景')
  })
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [sceneName, setSceneName] = useState(scene?.name || '新场景')

  const maxZ = puzzle.layers.length > 0 ? Math.max(...puzzle.layers.map((l) => l.zIndex)) : 0

  const handleAddLayer = useCallback((type: PuzzleLayer['type'], data: any) => {
    const newLayer = createLayer(type, data, 50, 50, maxZ + 1)
    setPuzzle((prev) => ({
      ...prev,
      layers: [...prev.layers, newLayer],
      updatedAt: Date.now(),
    }))
    setSelectedLayerId(newLayer.id)
  }, [maxZ])

  const handleDropLayer = useCallback((type: string, data: any, xPercent: number, yPercent: number) => {
    const newLayer = createLayer(type as PuzzleLayer['type'], data, xPercent, yPercent, maxZ + 1)
    setPuzzle((prev) => ({
      ...prev,
      layers: [...prev.layers, newLayer],
      updatedAt: Date.now(),
    }))
    setSelectedLayerId(newLayer.id)
  }, [maxZ])

  const handleUpdateLayer = useCallback((id: string, updates: Partial<PuzzleLayer>) => {
    setPuzzle((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
      updatedAt: Date.now(),
    }))
  }, [])

  const handleDeleteLayer = useCallback((id: string) => {
    setPuzzle((prev) => ({
      ...prev,
      layers: prev.layers.filter((l) => l.id !== id),
      updatedAt: Date.now(),
    }))
    if (selectedLayerId === id) {
      setSelectedLayerId(null)
    }
  }, [selectedLayerId])

  const handleMoveLayer = useCallback((id: string, direction: 'up' | 'down') => {
    setPuzzle((prev) => {
      const sorted = [...prev.layers].sort((a, b) => a.zIndex - b.zIndex)
      const idx = sorted.findIndex((l) => l.id === id)
      if (idx === -1) return prev

      const targetIdx = direction === 'up' ? idx + 1 : idx - 1
      if (targetIdx < 0 || targetIdx >= sorted.length) return prev

      const tempZ = sorted[idx].zIndex
      sorted[idx] = { ...sorted[idx], zIndex: sorted[targetIdx].zIndex }
      sorted[targetIdx] = { ...sorted[targetIdx], zIndex: tempZ }

      return {
        ...prev,
        layers: sorted,
        updatedAt: Date.now(),
      }
    })
  }, [])

  const handleAddTextLayer = useCallback(() => {
    handleAddLayer('text', { name: '文字' })
  }, [handleAddLayer])

  const handleSave = useCallback(() => {
    if (!scene) return
    const bgLayer = puzzle.layers.find((l) => l.type === 'background')
    const updatedScene: ComicScene = {
      ...scene,
      name: sceneName,
      backgroundImage: bgLayer?.url || scene.backgroundImage,
      thumbnail: bgLayer?.url,
      puzzleData: {
        ...puzzle,
        name: sceneName,
        updatedAt: Date.now(),
      },
    }
    onSave(updatedScene)
  }, [scene, puzzle, sceneName, onSave])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedLayerId && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          handleDeleteLayer(selectedLayerId)
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault()
        // duplicate
        const layer = puzzle.layers.find((l) => l.id === selectedLayerId)
        if (layer) {
          const newLayer: PuzzleLayer = {
            ...layer,
            id: `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: `${layer.name} 副本`,
            zIndex: maxZ + 1,
            x: layer.x + 5,
            y: layer.y + 5,
          }
          setPuzzle((prev) => ({
            ...prev,
            layers: [...prev.layers, newLayer],
            updatedAt: Date.now(),
          }))
          setSelectedLayerId(newLayer.id)
        }
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selectedLayerId, handleDeleteLayer, puzzle.layers, maxZ, onClose])

  if (!scene) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full h-full max-w-[1400px] max-h-[90vh] bg-slate-900 rounded-xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={sceneName}
              onChange={(e) => setSceneName(e.target.value)}
              className="bg-transparent text-sm font-semibold text-white border border-transparent hover:border-slate-700 focus:border-pink-500 focus:outline-none px-2 py-1 rounded transition-colors"
            />
            <span className="text-[10px] text-slate-500">{puzzle.layers.length} 个图层</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-xs bg-pink-500 hover:bg-pink-600 text-white rounded-md flex items-center gap-1 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              完成
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <AssetPanel characters={characters} onAddLayer={handleAddLayer} />
          <PuzzleCanvas
            scene={puzzle}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onUpdateLayer={handleUpdateLayer}
            onDropLayer={handleDropLayer}
          />
          <LayerPanel
            scene={puzzle}
            selectedLayerId={selectedLayerId}
            characters={characters}
            onSelectLayer={setSelectedLayerId}
            onUpdateLayer={handleUpdateLayer}
            onDeleteLayer={handleDeleteLayer}
            onMoveLayer={handleMoveLayer}
            onAddTextLayer={handleAddTextLayer}
          />
        </div>

        <div className="px-4 py-2 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <div className="text-[10px] text-slate-600">
            提示：拖拽素材到画布 · 选中图层按 Delete 删除 · Ctrl+D 复制
          </div>
          <div className="text-[10px] text-slate-600">
            {puzzle.width} × {puzzle.height}
          </div>
        </div>
      </div>
    </div>
  )
}

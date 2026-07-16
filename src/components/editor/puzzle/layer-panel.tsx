'use client'

import { Eye, EyeOff, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import type { PuzzleLayer, PuzzleScene, StoryCharacter } from '@editor/types/editor'
import { useState, memo } from 'react'

interface LayerPanelProps {
  scene: PuzzleScene
  selectedLayerId: string | null
  characters: StoryCharacter[]
  onSelectLayer: (id: string | null) => void
  onUpdateLayer: (id: string, updates: Partial<PuzzleLayer>) => void
  onDeleteLayer: (id: string) => void
  onMoveLayer: (id: string, direction: 'up' | 'down') => void
  onAddTextLayer: () => void
}

export function LayerPanel({
  scene,
  selectedLayerId,
  characters,
  onSelectLayer,
  onUpdateLayer,
  onDeleteLayer,
  onMoveLayer,
  onAddTextLayer,
}: LayerPanelProps) {
  const [expandedSection, setExpandedSection] = useState<'layers' | 'props'>('layers')
  const sortedLayers = [...scene.layers].sort((a, b) => b.zIndex - a.zIndex)
  const selectedLayer = scene.layers.find((l) => l.id === selectedLayerId) || null

  return (
    <div className="w-56 flex flex-col h-full bg-slate-900 border-l border-slate-800">
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-white">图层管理</h3>
        <button
          onClick={onAddTextLayer}
          className="text-[10px] px-2 py-1 bg-pink-500/20 text-pink-400 rounded-md hover:bg-pink-500/30 transition-colors"
        >
          + 文字
        </button>
      </div>

      <div
        className="border-b border-slate-800 cursor-pointer"
        onClick={() => setExpandedSection(expandedSection === 'layers' ? 'props' : 'layers')}
      >
        <div className="px-3 py-2 flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-300">图层列表 ({scene.layers.length})</span>
          <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${expandedSection === 'layers' ? '' : '-rotate-90'}`} />
        </div>
      </div>

      {expandedSection === 'layers' && (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sortedLayers.length === 0 && (
            <div className="text-center py-8 text-slate-600 text-[11px]">
              从左侧拖拽素材到画布
            </div>
          )}
          {sortedLayers.map((layer) => (
            <div
              key={layer.id}
              onClick={() => onSelectLayer(layer.id)}
              className={`group flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition-colors ${
                selectedLayerId === layer.id
                  ? 'bg-pink-500/20 border border-pink-500/50'
                  : 'bg-slate-800/50 border border-transparent hover:bg-slate-800 hover:border-slate-700'
              }`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onUpdateLayer(layer.id, { visible: !layer.visible })
                }}
                className="text-slate-500 hover:text-white transition-colors shrink-0"
              >
                {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>

              <div className="w-6 h-6 rounded bg-slate-700 shrink-0 overflow-hidden">
                {layer.type === 'text' ? (
                  <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-400">T</div>
                ) : (
                  <img src={layer.url} alt="" className="w-full h-full object-cover" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-white truncate">{layer.name}</p>
                <p className="text-[9px] text-slate-500">
                  {layer.type === 'background' ? '背景' : layer.type === 'image' ? '图片' : layer.type === 'character' ? '角色' : layer.type === 'text' ? '文字' : '特效'}
                </p>
              </div>

              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onMoveLayer(layer.id, 'up')
                  }}
                  className="p-0.5 text-slate-500 hover:text-white transition-colors"
                  title="上移"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onMoveLayer(layer.id, 'down')
                  }}
                  className="p-0.5 text-slate-500 hover:text-white transition-colors"
                  title="下移"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteLayer(layer.id)
                  }}
                  className="p-0.5 text-slate-500 hover:text-red-400 transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedLayer && (
        <div className="border-t border-slate-800 p-3 space-y-3 max-h-[60%] overflow-y-auto">
          <div className="text-[11px] font-medium text-pink-400">属性</div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400">名称</label>
            <input
              type="text"
              value={selectedLayer.name}
              onChange={(e) => onUpdateLayer(selectedLayer.id, { name: e.target.value })}
              className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-pink-500"
            />
          </div>

          {selectedLayer.type === 'character' && (
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400">表情</label>
              <select
                value={selectedLayer.emotion || 'normal'}
                onChange={(e) => {
                  const char = characters.find((c) => c.id === selectedLayer.characterId)
                  const sprite = char?.sprites?.find((s) => s.emotion === e.target.value)
                  onUpdateLayer(selectedLayer.id, {
                    emotion: e.target.value,
                    url: sprite?.url || sprite?.image || selectedLayer.url,
                  })
                }}
                className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-pink-500"
              >
                <option value="normal">普通</option>
                <option value="happy">开心</option>
                <option value="sad">伤心</option>
                <option value="angry">生气</option>
                <option value="surprised">惊讶</option>
                <option value="embarrassed">害羞</option>
                <option value="thinking">思考</option>
                <option value="scared">害怕</option>
              </select>
            </div>
          )}

          {selectedLayer.type === 'text' && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">文本内容</label>
                <textarea
                  value={selectedLayer.textContent || ''}
                  onChange={(e) => onUpdateLayer(selectedLayer.id, { textContent: e.target.value })}
                  rows={3}
                  className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-pink-500 resize-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">字号</label>
                <input
                  type="number"
                  value={selectedLayer.fontSize || 16}
                  onChange={(e) => onUpdateLayer(selectedLayer.id, { fontSize: Number(e.target.value) })}
                  className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-pink-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">颜色</label>
                <div className="flex gap-1">
                  <input
                    type="color"
                    value={selectedLayer.fontColor || '#ffffff'}
                    onChange={(e) => onUpdateLayer(selectedLayer.id, { fontColor: e.target.value })}
                    className="w-8 h-6 rounded border border-slate-700 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={selectedLayer.fontColor || '#ffffff'}
                    onChange={(e) => onUpdateLayer(selectedLayer.id, { fontColor: e.target.value })}
                    className="flex-1 px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>
            </>
          )}

          {selectedLayer.type !== 'background' && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">位置 X (%)</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={selectedLayer.x}
                  onChange={(e) => onUpdateLayer(selectedLayer.id, { x: Number(e.target.value) })}
                  className="w-full accent-pink-500"
                />
                <div className="text-[9px] text-slate-500 text-right">{selectedLayer.x.toFixed(1)}%</div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">位置 Y (%)</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={selectedLayer.y}
                  onChange={(e) => onUpdateLayer(selectedLayer.id, { y: Number(e.target.value) })}
                  className="w-full accent-pink-500"
                />
                <div className="text-[9px] text-slate-500 text-right">{selectedLayer.y.toFixed(1)}%</div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">宽度 (%)</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={selectedLayer.width}
                  onChange={(e) => onUpdateLayer(selectedLayer.id, { width: Number(e.target.value) })}
                  className="w-full accent-pink-500"
                />
                <div className="text-[9px] text-slate-500 text-right">{selectedLayer.width.toFixed(0)}%</div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">旋转 (°)</label>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={selectedLayer.rotation}
                  onChange={(e) => onUpdateLayer(selectedLayer.id, { rotation: Number(e.target.value) })}
                  className="w-full accent-pink-500"
                />
                <div className="text-[9px] text-slate-500 text-right">{selectedLayer.rotation}°</div>
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400">透明度</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={selectedLayer.opacity}
              onChange={(e) => onUpdateLayer(selectedLayer.id, { opacity: Number(e.target.value) })}
              className="w-full accent-pink-500"
            />
            <div className="text-[9px] text-slate-500 text-right">{Math.round(selectedLayer.opacity * 100)}%</div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400">入场动画</label>
            <select
              value={selectedLayer.animation?.type || 'none'}
              onChange={(e) => onUpdateLayer(selectedLayer.id, {
                animation: {
                  type: e.target.value as any,
                  duration: selectedLayer.animation?.duration || 300,
                  delay: selectedLayer.animation?.delay || 0,
                },
              })}
              className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-pink-500"
            >
              <option value="none">无</option>
              <option value="fade-in">淡入</option>
              <option value="slide-left">从左滑入</option>
              <option value="slide-right">从右滑入</option>
              <option value="slide-up">从下滑入</option>
              <option value="slide-down">从上滑入</option>
              <option value="zoom-in">放大进入</option>
              <option value="bounce">弹跳</option>
            </select>
          </div>

          {selectedLayer.type !== 'background' && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-slate-400">交互选项</label>
                <button
                  type="button"
                  onClick={() => onUpdateLayer(selectedLayer.id, { clickable: !selectedLayer.clickable })}
                  className={`relative w-8 h-4 rounded-full transition-colors ${
                    selectedLayer.clickable ? 'bg-pink-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                      selectedLayer.clickable ? 'translate-x-4' : ''
                    }`}
                  />
                </button>
              </div>

              {selectedLayer.clickable && (
                <div className="space-y-2 pl-1">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">选项文本</label>
                    <input
                      type="text"
                      value={selectedLayer.choiceOptionText || ''}
                      onChange={(e) => onUpdateLayer(selectedLayer.id, { choiceOptionText: e.target.value })}
                      placeholder="例如：打开箱子"
                      className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-pink-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">悬停效果</label>
                    <select
                      value={selectedLayer.hoverEffect || 'highlight'}
                      onChange={(e) => onUpdateLayer(selectedLayer.id, {
                        hoverEffect: e.target.value as 'highlight' | 'scale' | 'glow' | 'none',
                      })}
                      className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-pink-500"
                    >
                      <option value="highlight">高亮</option>
                      <option value="scale">放大</option>
                      <option value="glow">发光</option>
                      <option value="none">无</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default memo(LayerPanel)

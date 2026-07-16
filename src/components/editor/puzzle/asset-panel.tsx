'use client'

import { useState, memo } from 'react'
import { Search, Upload, Image as ImageIcon, User, Sparkles, Package } from 'lucide-react'
import type { StoryCharacter } from '@editor/types/editor'

interface AssetPanelProps {
  characters: StoryCharacter[]
  onAddLayer: (type: 'background' | 'image' | 'character' | 'text' | 'effect', data: any) => void
}

type AssetCategory = 'background' | 'item' | 'character' | 'effect' | 'upload'

const PRESET_BACKGROUNDS = [
  { name: '古风庭院', url: 'https://picsum.photos/seed/garden/800/600' },
  { name: '现代公寓', url: 'https://picsum.photos/seed/apartment/800/600' },
  { name: '科幻舰桥', url: 'https://picsum.photos/seed/bridge/800/600' },
  { name: '校园教室', url: 'https://picsum.photos/seed/classroom/800/600' },
  { name: '森林小径', url: 'https://picsum.photos/seed/forest/800/600' },
  { name: '城市街道', url: 'https://picsum.photos/seed/street/800/600' },
]

const PRESET_ITEMS = [
  { name: '石桌', url: 'https://picsum.photos/seed/table/200/150' },
  { name: '茶壶', url: 'https://picsum.photos/seed/teapot/100/100' },
  { name: '宝剑', url: 'https://picsum.photos/seed/sword/80/300' },
  { name: '魔法书', url: 'https://picsum.photos/seed/book/150/200' },
  { name: '花朵', url: 'https://picsum.photos/seed/flower/100/100' },
  { name: '宝箱', url: 'https://picsum.photos/seed/chest/150/120' },
]

const PRESET_EFFECTS = [
  { name: '光晕', url: 'https://picsum.photos/seed/glow/400/400' },
  { name: '烟雾', url: 'https://picsum.photos/seed/smoke/400/300' },
  { name: '火花', url: 'https://picsum.photos/seed/spark/300/300' },
  { name: '闪电', url: 'https://picsum.photos/seed/lightning/300/500' },
]

export function AssetPanel({ characters, onAddLayer }: AssetPanelProps) {
  const [activeCategory, setActiveCategory] = useState<AssetCategory>('background')
  const [searchQuery, setSearchQuery] = useState('')

  const categories = [
    { id: 'background' as const, label: '背景', icon: ImageIcon },
    { id: 'item' as const, label: '物品', icon: Package },
    { id: 'character' as const, label: '角色', icon: User },
    { id: 'effect' as const, label: '特效', icon: Sparkles },
    { id: 'upload' as const, label: '我的上传', icon: Upload },
  ]

  const handleDragStart = (e: React.DragEvent, type: string, data: any) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type, data }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleAddClick = (type: 'background' | 'image' | 'character' | 'text' | 'effect', data: any) => {
    onAddLayer(type, data)
  }

  const renderContent = () => {
    switch (activeCategory) {
      case 'background': {
        const filteredAssets = searchQuery.trim()
          ? PRESET_BACKGROUNDS.filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
          : PRESET_BACKGROUNDS
        return (
          <div className="grid grid-cols-2 gap-2">
            {filteredAssets.map((item) => (
              <div
                key={item.name}
                draggable
                onDragStart={(e) => handleDragStart(e, 'background', item)}
                onClick={() => handleAddClick('background', item)}
                className="group relative aspect-video rounded-lg overflow-hidden border border-slate-700 hover:border-pink-500 cursor-grab active:cursor-grabbing transition-colors"
              >
                <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-1 left-1 right-1">
                  <p className="text-[10px] text-white truncate">{item.name}</p>
                </div>
              </div>
            ))}
          </div>
        )
      }

      case 'item': {
        const filteredAssets = searchQuery.trim()
          ? PRESET_ITEMS.filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
          : PRESET_ITEMS
        return (
          <div className="grid grid-cols-3 gap-2">
            {filteredAssets.map((item) => (
              <div
                key={item.name}
                draggable
                onDragStart={(e) => handleDragStart(e, 'image', item)}
                onClick={() => handleAddClick('image', item)}
                className="group relative aspect-square rounded-lg overflow-hidden border border-slate-700 hover:border-pink-500 cursor-grab active:cursor-grabbing transition-colors bg-slate-800/50"
              >
                <img src={item.url} alt={item.name} className="w-full h-full object-contain p-2" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                  <p className="text-[9px] text-white text-center truncate">{item.name}</p>
                </div>
              </div>
            ))}
          </div>
        )
      }

      case 'character': {
        const filteredAssets = searchQuery.trim()
          ? characters.filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
          : characters
        return (
          <div className="space-y-2">
            {characters.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                暂无角色<br />
                先在角色面板添加角色
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {filteredAssets.map((char) => (
                  <div
                    key={char.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'character', { characterId: char.id, name: char.name, avatar: char.avatar })}
                    onClick={() => handleAddClick('character', { characterId: char.id, name: char.name, avatar: char.avatar })}
                    className="group relative aspect-[3/4] rounded-lg overflow-hidden border border-slate-700 hover:border-pink-500 cursor-grab active:cursor-grabbing transition-colors"
                  >
                    <img src={char.avatar} alt={char.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute bottom-1 left-1 right-1">
                      <p className="text-[10px] text-white font-medium truncate">{char.name}</p>
                    </div>
                    <div className="absolute top-1 left-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: char.color }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      }

      case 'effect': {
        const filteredAssets = searchQuery.trim()
          ? PRESET_EFFECTS.filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
          : PRESET_EFFECTS
        return (
          <div className="grid grid-cols-2 gap-2">
            {filteredAssets.map((item) => (
              <div
                key={item.name}
                draggable
                onDragStart={(e) => handleDragStart(e, 'effect', item)}
                onClick={() => handleAddClick('effect', item)}
                className="group relative aspect-square rounded-lg overflow-hidden border border-slate-700 hover:border-pink-500 cursor-grab active:cursor-grabbing transition-colors bg-slate-800/50"
              >
                <img src={item.url} alt={item.name} className="w-full h-full object-cover mix-screen" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                  <p className="text-[9px] text-white text-center">{item.name}</p>
                </div>
              </div>
            ))}
          </div>
        )
      }

      case 'upload':
        return (
          <div className="space-y-3">
            <label className="block border-2 border-dashed border-slate-700 rounded-lg p-4 text-center hover:border-pink-500/50 transition-colors cursor-pointer">
              <Upload className="w-6 h-6 text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-slate-400">点击或拖拽上传图片</p>
              <p className="text-[10px] text-slate-600 mt-1">支持 JPG/PNG/WebP</p>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files
                  if (files) {
                    Array.from(files).forEach((file) => {
                      const reader = new FileReader()
                      reader.onload = () => {
                        const url = reader.result as string
                        onAddLayer('image', { name: file.name, url })
                      }
                      reader.readAsDataURL(file)
                    })
                  }
                }}
              />
            </label>
            <p className="text-[10px] text-slate-600 text-center">
              上传的图片会自动添加到场景中
            </p>
          </div>
        )
    }
  }

  return (
    <div className="w-52 flex flex-col h-full bg-slate-900 border-r border-slate-800">
      <div className="p-2 border-b border-slate-800">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索素材..."
            className="w-full pl-7 pr-2 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
          />
        </div>
      </div>

      <div className="flex border-b border-slate-800 overflow-x-auto">
        {categories.map((cat) => {
          const Icon = cat.icon
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-1 min-w-0 py-2 flex flex-col items-center gap-0.5 text-[10px] transition-colors ${
                activeCategory === cat.id
                  ? 'bg-slate-800 text-pink-400 border-b-2 border-pink-500'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate w-full text-center px-0.5">{cat.label}</span>
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {renderContent()}
      </div>
    </div>
  )
}

export default memo(AssetPanel)

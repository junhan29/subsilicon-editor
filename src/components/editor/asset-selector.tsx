'use client'

import { useState, useEffect } from 'react'
import { Input } from '@editor/components/ui/input'
import { Button } from '@editor/components/ui/button'
import { Card, CardContent } from '@editor/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@editor/components/ui/sheet'
import {
  Search,
  Image as ImageIcon,
  Check,
  Loader2,
  FolderOpen,
} from 'lucide-react'

interface Asset {
  id: string
  name: string
  slug: string
  thumbnailUrl: string
  category: string
  license: string
}

interface AssetSelectorProps {
  selectedAssetId?: string
  onSelect: (asset: Asset | null) => void
  category?: string
  trigger?: any
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const categoryLabels: Record<string, string> = {
  CHARACTER: '角色',
  ITEM: '物品',
  SCENE: '场景',
  SFX: '音效',
  EFFECT: '特效',
  SPRITE: '立绘',
  VIDEO: '视频',
}

const categoryIcons: Record<string, string> = {
  CHARACTER: '👤',
  ITEM: '🎁',
  SCENE: '🏞️',
  SFX: '🎵',
  EFFECT: '✨',
  SPRITE: '🖼️',
  VIDEO: '🎬',
}

export function AssetSelector({
  selectedAssetId,
  onSelect,
  category,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: AssetSelectorProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>(category || 'ALL')
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)

  // 获取素材列表
  useEffect(() => {
    if (!open) return

    const fetchAssets = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (search) params.set('search', search)
        if (selectedCategory && selectedCategory !== 'ALL') {
          params.set('category', selectedCategory)
        }
        params.set('limit', '50')
        params.set('sort', 'popular')

        const res = await fetch(`/api/assets?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setAssets(data.assets)
        }
      } catch (error) {
        console.error('Failed to fetch assets:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAssets()
  }, [open, search, selectedCategory])

  const handleSelect = (asset: Asset) => {
    if (selectedAssetId === asset.id) {
      setSelectedAsset(null)
      onSelect(null)
      setOpen(false)
    } else {
      setSelectedAsset(asset)
      onSelect(asset)
      setOpen(false)
    }
  }

  // 分类列表
  const categories = ['ALL', 'CHARACTER', 'ITEM', 'SCENE', 'SFX', 'EFFECT', 'SPRITE', 'VIDEO']

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!!trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent className="w-[400px] sm:w-[500px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            选择素材
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="搜索素材..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* 分类筛选 */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 transition-colors ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat !== 'ALL' && categoryIcons[cat] && (
                  <span className="text-xs">{categoryIcons[cat]}</span>
                )}
                {cat === 'ALL' ? '全部' : categoryLabels[cat] || cat}
              </button>
            ))}
          </div>

          {/* 素材列表 */}
          <div className="h-[calc(100vh-280px)] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              </div>
            ) : assets.length === 0 ? (
              <div className="text-center py-20">
                <ImageIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-muted-foreground">未找到素材</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {assets.map((asset) => {
                  const isSelected = selectedAssetId === asset.id

                  return (
                    <Card
                      key={asset.id}
                      className={`group cursor-pointer transition-all ${
                        isSelected
                          ? 'ring-2 ring-amber-500 bg-amber-50'
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => handleSelect(asset)}
                    >
                      <div className="relative aspect-square rounded-t-lg overflow-hidden bg-gray-100">
                        <img
                          src={asset.thumbnailUrl}
                          alt={asset.name}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        {/* 选中标记 */}
                        {isSelected && (
                          <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
                              <Check className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                      <CardContent className="p-2">
                        <p className="text-xs font-medium truncate">{asset.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {categoryLabels[asset.category] || asset.category}
                        </p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

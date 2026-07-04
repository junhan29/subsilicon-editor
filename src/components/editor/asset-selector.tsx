'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { getAllAssets, StoredAsset } from '@editor/lib/local-db/asset-store'

interface Asset {
  id: string
  name: string
  slug: string
  thumbnailUrl: string
  category: string
  license: string
}

/**
 * 将本地 IndexedDB 中存储的素材映射为选择器使用的 Asset 结构
 * 由于本地素材不包含分类信息，根据 MIME 类型推断所属分类
 */
function mapStoredAsset(asset: StoredAsset): Asset {
  let category = 'SCENE'
  if (asset.type.startsWith('audio/')) {
    category = 'SFX'
  } else if (asset.type.startsWith('video/')) {
    category = 'VIDEO'
  } else if (asset.type.startsWith('image/')) {
    category = 'SCENE'
  }

  // 仅图片类型可生成缩略图，音视频等其他类型暂无缩略图
  const thumbnailUrl = asset.type.startsWith('image/')
    ? URL.createObjectURL(asset.blob)
    : ''

  return {
    id: asset.hash,
    name: asset.name,
    slug: asset.name.replace(/\s+/g, '-').toLowerCase(),
    thumbnailUrl,
    category,
    license: 'local',
  }
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

  // 从本地 IndexedDB 加载素材（不再调用网站 API）
  useEffect(() => {
    if (!open) return

    const loadLocalAssets = async () => {
      setLoading(true)
      try {
        const storedAssets = await getAllAssets()
        setAssets(storedAssets.map(mapStoredAsset))
      } catch (error) {
        console.error('Failed to load local assets:', error)
        setAssets([])
      } finally {
        setLoading(false)
      }
    }

    loadLocalAssets()
  }, [open])

  // 本地过滤素材（保留搜索和分类筛选功能）
  const filteredAssets = useMemo(() => {
    let result = assets
    if (selectedCategory !== 'ALL') {
      result = result.filter((a) => a.category === selectedCategory)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((a) => a.name.toLowerCase().includes(q))
    }
    return result
  }, [assets, search, selectedCategory])

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
              // 本地素材库为空时的提示
              <div className="text-center py-20">
                <ImageIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-muted-foreground">暂无素材，请导入素材包</p>
              </div>
            ) : filteredAssets.length === 0 ? (
              // 有素材但搜索/筛选后无匹配
              <div className="text-center py-20">
                <ImageIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-muted-foreground">未找到匹配的素材</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredAssets.map((asset) => {
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
                        {asset.thumbnailUrl ? (
                          <img
                            src={asset.thumbnailUrl}
                            alt={asset.name}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          // 非图片素材占位
                          <div className="absolute inset-0 flex items-center justify-center text-3xl">
                            {categoryIcons[asset.category] || '📦'}
                          </div>
                        )}
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

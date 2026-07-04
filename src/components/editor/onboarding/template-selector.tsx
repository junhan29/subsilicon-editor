'use client'

import { useState } from 'react'
import { X, Sparkles, Clock, GitBranch, Users, Flag, Search, ChevronRight, Star, Lock, Check } from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import { storyTemplates, templateCategories, type StoryTemplate } from '@editor/lib/story-templates'
import type { StoryGraph } from '@editor/types/editor'

interface TemplateSelectorProps {
  open: boolean
  onClose: () => void
  onSelectTemplate: (template: StoryTemplate) => void
  onStartFromBlank: () => void
}

const DIFFICULTY_LABELS = {
  easy: { label: '入门', color: 'text-green-600 bg-green-50 border-green-200' },
  medium: { label: '初级', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  hard: { label: '高级', color: 'text-red-600 bg-red-50 border-red-200' },
}

const CATEGORY_ICONS: Record<string, string> = {
  beginner: '🎯',
  romance: '💕',
  mystery: '🔍',
  horror: '👻',
  adventure: '⚔️',
}

export function TemplateSelector({ open, onClose, onSelectTemplate, onStartFromBlank }: TemplateSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [previewTemplate, setPreviewTemplate] = useState<StoryTemplate | null>(null)

  if (!open) return null

  const filteredTemplates = storyTemplates.filter(t => {
    const matchesCategory = !selectedCategory || t.category === selectedCategory
    const matchesSearch = !searchQuery || 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.features.some(f => f.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesCategory && matchesSearch
  })

  const handleSelectTemplate = (template: StoryTemplate) => {
    onSelectTemplate(template)
    onClose()
  }

  const handleStartFromBlank = () => {
    onStartFromBlank()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-background rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* 顶部标题栏 */}
        <div className="relative px-6 py-5 border-b border-border bg-gradient-to-r from-primary/5 via-primary/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">选择故事模板</h2>
              <p className="text-xs text-muted-foreground">从模板开始，快速创建你的互动故事</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-black/10 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* 搜索栏 */}
        <div className="px-6 py-3 border-b border-border bg-muted/20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索模板名称、功能..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        {/* 分类标签 */}
        <div className="px-6 py-3 border-b border-border flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !selectedCategory 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            全部
          </button>
          {templateCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                selectedCategory === cat.id 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        {/* 模板列表 */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>没有找到匹配的模板</p>
              <p className="text-xs mt-1">试试其他搜索词或分类</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onPreview={() => setPreviewTemplate(template)}
                  onSelect={() => handleSelectTemplate(template)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 底部：从空白开始 */}
        <div className="px-6 py-4 border-t border-border bg-muted/30">
          <Button
            variant="outline"
            onClick={handleStartFromBlank}
            className="w-full gap-2 h-11 border-dashed"
          >
            <span>从空白故事开始</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* 模板预览弹窗 */}
        {previewTemplate && (
          <TemplatePreviewModal
            template={previewTemplate}
            onClose={() => setPreviewTemplate(null)}
            onSelect={() => {
              handleSelectTemplate(previewTemplate)
              setPreviewTemplate(null)
            }}
          />
        )}
      </div>
    </div>
  )
}

interface TemplateCardProps {
  template: StoryTemplate
  onPreview: () => void
  onSelect: () => void
}

function TemplateCard({ template, onPreview, onSelect }: TemplateCardProps) {
  const difficultyInfo = DIFFICULTY_LABELS[template.difficulty]

  return (
    <div className="group relative bg-card rounded-xl border border-border overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all">
      {/* 封面图 */}
      <div className="relative h-36 overflow-hidden">
        <img
          src={template.thumbnail}
          alt={template.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        
        {/* 分类标签 */}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur text-[10px] text-white flex items-center gap-1">
          <span>{CATEGORY_ICONS[template.category]}</span>
          <span>{templateCategories.find(c => c.id === template.category)?.name}</span>
        </div>

        {/* 难度标签 */}
        <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium border ${difficultyInfo.color}`}>
          {difficultyInfo.label}
        </div>

        {/* 预览按钮 */}
        <button
          onClick={(e) => { e.stopPropagation(); onPreview(); }}
          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <span className="px-3 py-1.5 rounded-full bg-white/90 text-xs font-medium text-gray-900">预览详情</span>
        </button>
      </div>

      {/* 内容 */}
      <div className="p-3">
        <h3 className="font-semibold text-sm mb-1">{template.name}</h3>
        <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">{template.description}</p>
        
        {/* 统计信息 */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <GitBranch className="w-3 h-3" />
            {template.defaultGraph.nodes.length} 节点
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {template.defaultGraph.characters.length} 角色
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {template.estimatedTime}
          </span>
        </div>

        {/* 功能标签 */}
        <div className="flex flex-wrap gap-1 mb-3">
          {template.features.slice(0, 3).map((feature) => (
            <span key={feature} className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">
              {feature}
            </span>
          ))}
          {template.features.length > 3 && (
            <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">
              +{template.features.length - 3}
            </span>
          )}
        </div>

        {/* 选择按钮 */}
        <Button size="sm" onClick={onSelect} className="w-full gap-1 h-8 text-xs">
          <span>使用此模板</span>
          <ChevronRight className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}

interface TemplatePreviewModalProps {
  template: StoryTemplate
  onClose: () => void
  onSelect: () => void
}

function TemplatePreviewModal({ template, onClose, onSelect }: TemplatePreviewModalProps) {
  const difficultyInfo = DIFFICULTY_LABELS[template.difficulty]

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-background rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="relative h-48 overflow-hidden">
          <img
            src={template.thumbnail}
            alt={template.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded-full bg-black/50 backdrop-blur text-[10px] text-white flex items-center gap-1">
                {CATEGORY_ICONS[template.category]}
                <span>{templateCategories.find(c => c.id === template.category)?.name}</span>
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${difficultyInfo.color}`}>
                {difficultyInfo.label}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">{template.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur hover:bg-black/70 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 描述 */}
          <div>
            <h3 className="text-sm font-semibold mb-2">模板介绍</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{template.description}</p>
          </div>

          {/* 统计 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={<GitBranch className="w-4 h-4" />} label="节点数量" value={`${template.defaultGraph.nodes.length} 个`} />
            <StatCard icon={<Users className="w-4 h-4" />} label="角色数量" value={`${template.defaultGraph.characters.length} 个`} />
            <StatCard icon={<Flag className="w-4 h-4" />} label="结局数量" value={`${template.defaultGraph.nodes.filter(n => n.type === 'ending').length} 个`} />
            <StatCard icon={<Clock className="w-4 h-4" />} label="完成时间" value={template.estimatedTime} />
          </div>

          {/* 功能特点 */}
          <div>
            <h3 className="text-sm font-semibold mb-2">功能特点</h3>
            <div className="flex flex-wrap gap-2">
              {template.features.map((feature) => (
                <span key={feature} className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  {feature}
                </span>
              ))}
            </div>
          </div>

          {/* 角色预览 */}
          {template.defaultGraph.characters.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">预设角色</h3>
              <div className="flex flex-wrap gap-2">
                {template.defaultGraph.characters.map((char) => (
                  <div key={char.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: char.color || '#666' }}
                    >
                      {char.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{char.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {/* 尝试多个可能的描述字段 */}
                        {(char as any).description || (char as any).bio || ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 变量预览 */}
          {template.defaultGraph.variables.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">预设变量</h3>
              <div className="space-y-2">
                {template.defaultGraph.variables.map((v) => (
                  <div key={(v as any).id || v.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted text-xs">
                    <span className="font-medium">{v.name}</span>
                    <span className="text-muted-foreground">
                      {v.type}: {typeof v.initialValue === 'object' ? JSON.stringify(v.initialValue) : String(v.initialValue)}
                      {(v as any).min !== undefined && (v as any).max !== undefined && ` (${(v as any).min}~${(v as any).max})`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            返回选择
          </Button>
          <Button onClick={onSelect} className="flex-1 gap-2">
            <span>使用此模板创建</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/50">
      <div className="text-muted-foreground">{icon}</div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  )
}

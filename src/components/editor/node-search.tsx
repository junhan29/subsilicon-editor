'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Search, X, ArrowUp, ArrowDown, CornerDownLeft, Replace, ChevronDown, ChevronUp } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import type { StoryNode, StoryCharacter } from '@editor/types/editor'

interface SearchMatch {
  nodeId: string
  nodeType: string
  fieldPath: string
  fieldLabel: string
  matchText: string
  beforeText: string
  afterText: string
  nodeTitle: string
  characterName?: string
}

interface NodeSearchProps {
  nodes: StoryNode[]
  characters?: StoryCharacter[]
  open: boolean
  onClose: () => void
  onReplaceNode?: (nodeId: string, data: Partial<StoryNode['data']>) => void
}

const nodeTypeLabels: Record<string, string> = {
  dialogue: '对话',
  choice: '选择',
  gather: '汇聚',
  condition: '条件',
  unlock: '付费',
  ending: '结局',
  cg: 'CG过场',
  jump: '跳转',
  random: '随机',
  narration: '旁白',
}

const fieldLabels: Record<string, string> = {
  text: '文本',
  characterId: '角色',
  prompt: '提示',
  'options.text': '选项',
  title: '标题',
  subtitle: '副标题',
  nodeTitle: '节点标题',
  description: '描述',
  label: '标签',
  expression: '表达式',
  trueLabel: '是标签',
  falseLabel: '否标签',
  'options.label': '选项标签',
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findMatchesInText(
  text: string,
  query: string,
  caseSensitive: boolean,
  nodeId: string,
  nodeType: string,
  fieldPath: string,
  fieldLabel: string,
  nodeTitle: string,
  characterName?: string
): SearchMatch[] {
  if (!text || !query) return []

  const flags = caseSensitive ? 'g' : 'gi'
  const regex = new RegExp(escapeRegExp(query), flags)
  const matches: SearchMatch[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const start = Math.max(0, match.index - 20)
    const end = Math.min(text.length, match.index + query.length + 20)
    const beforeText = start > 0 ? '...' + text.slice(start, match.index) : text.slice(start, match.index)
    const afterText = end < text.length ? text.slice(match.index + query.length, end) + '...' : text.slice(match.index + query.length, end)

    matches.push({
      nodeId,
      nodeType,
      fieldPath,
      fieldLabel,
      matchText: match[0],
      beforeText,
      afterText,
      nodeTitle,
      characterName,
    })
  }

  return matches
}

function getNodeTitle(node: StoryNode): string {
  const data = node.data as Record<string, unknown> | undefined
  return String(data?.title || data?.label || data?.nodeTitle || node.id)
}

function getCharacterName(characters: StoryCharacter[] | undefined, characterId: string): string {
  if (!characters || !characterId) return characterId
  const char = characters.find(c => c.id === characterId)
  return char?.name || characterId
}

function findAllMatches(
  nodes: StoryNode[],
  characters: StoryCharacter[] | undefined,
  query: string,
  caseSensitive: boolean
): SearchMatch[] {
  if (!query.trim()) return []

  const allMatches: SearchMatch[] = []

  for (const node of nodes) {
    const data = node.data as Record<string, unknown> | undefined
    if (!data) continue

    const nodeTitle = getNodeTitle(node)
    const nodeType = node.type || ''

    switch (nodeType as string) {
      case 'dialogue': {
        const characterId = String(data.characterId || '')
        const characterName = getCharacterName(characters, characterId)
        allMatches.push(...findMatchesInText(
          String(data.text || ''),
          query, caseSensitive,
          node.id, nodeType, 'text', '文本',
          nodeTitle, characterName
        ))
        if (characterName) {
          allMatches.push(...findMatchesInText(
            characterName,
            query, caseSensitive,
            node.id, nodeType, 'characterId', '角色',
            nodeTitle, characterName
          ))
        }
        break
      }
      case 'narration': {
        allMatches.push(...findMatchesInText(
          String(data.text || ''),
          query, caseSensitive,
          node.id, nodeType, 'text', '文本',
          nodeTitle
        ))
        break
      }
      case 'choice': {
        allMatches.push(...findMatchesInText(
          String(data.prompt || ''),
          query, caseSensitive,
          node.id, nodeType, 'prompt', '提示',
          nodeTitle
        ))
        const options = (data.options as Array<Record<string, unknown>>) || []
        options.forEach((opt, idx) => {
          allMatches.push(...findMatchesInText(
            String(opt.text || ''),
            query, caseSensitive,
            node.id, nodeType, `options.${idx}.text`, '选项',
            nodeTitle
          ))
        })
        break
      }
      case 'ending': {
        allMatches.push(...findMatchesInText(
          String(data.title || ''),
          query, caseSensitive,
          node.id, nodeType, 'title', '标题',
          nodeTitle
        ))
        allMatches.push(...findMatchesInText(
          String(data.subtitle || ''),
          query, caseSensitive,
          node.id, nodeType, 'subtitle', '副标题',
          nodeTitle
        ))
        allMatches.push(...findMatchesInText(
          String(data.text || ''),
          query, caseSensitive,
          node.id, nodeType, 'text', '文本',
          nodeTitle
        ))
        break
      }
      case 'unlock': {
        allMatches.push(...findMatchesInText(
          String(data.nodeTitle || ''),
          query, caseSensitive,
          node.id, nodeType, 'nodeTitle', '节点标题',
          nodeTitle
        ))
        allMatches.push(...findMatchesInText(
          String(data.description || ''),
          query, caseSensitive,
          node.id, nodeType, 'description', '描述',
          nodeTitle
        ))
        break
      }
      case 'cg': {
        allMatches.push(...findMatchesInText(
          String(data.title || ''),
          query, caseSensitive,
          node.id, nodeType, 'title', '标题',
          nodeTitle
        ))
        allMatches.push(...findMatchesInText(
          String(data.subtitle || ''),
          query, caseSensitive,
          node.id, nodeType, 'subtitle', '副标题',
          nodeTitle
        ))
        break
      }
      case 'jump': {
        allMatches.push(...findMatchesInText(
          String(data.label || ''),
          query, caseSensitive,
          node.id, nodeType, 'label', '标签',
          nodeTitle
        ))
        break
      }
      case 'random': {
        allMatches.push(...findMatchesInText(
          String(data.label || ''),
          query, caseSensitive,
          node.id, nodeType, 'label', '标签',
          nodeTitle
        ))
        const options = (data.options as Array<Record<string, unknown>>) || []
        options.forEach((opt, idx) => {
          allMatches.push(...findMatchesInText(
            String(opt.label || ''),
            query, caseSensitive,
            node.id, nodeType, `options.${idx}.label`, '选项标签',
            nodeTitle
          ))
        })
        break
      }
      case 'condition': {
        allMatches.push(...findMatchesInText(
          String(data.expression || ''),
          query, caseSensitive,
          node.id, nodeType, 'expression', '表达式',
          nodeTitle
        ))
        allMatches.push(...findMatchesInText(
          String(data.trueLabel || ''),
          query, caseSensitive,
          node.id, nodeType, 'trueLabel', '是标签',
          nodeTitle
        ))
        allMatches.push(...findMatchesInText(
          String(data.falseLabel || ''),
          query, caseSensitive,
          node.id, nodeType, 'falseLabel', '否标签',
          nodeTitle
        ))
        break
      }
      case 'gather': {
        allMatches.push(...findMatchesInText(
          String(data.label || ''),
          query, caseSensitive,
          node.id, nodeType, 'label', '标签',
          nodeTitle
        ))
        break
      }
    }
  }

  return allMatches
}

function updateNodeDataWithReplace(
  nodeData: Record<string, unknown>,
  fieldPath: string,
  searchText: string,
  replaceText: string,
  caseSensitive: boolean
): Record<string, unknown> {
  const parts = fieldPath.split('.')
  const newData = JSON.parse(JSON.stringify(nodeData))

  if (parts.length === 1) {
    const field = parts[0]
    const value = String(newData[field] || '')
    const flags = caseSensitive ? 'g' : 'gi'
    newData[field] = value.replace(new RegExp(escapeRegExp(searchText), flags), replaceText)
  } else if (parts.length === 3 && parts[0] === 'options') {
    const index = parseInt(parts[1], 10)
    const field = parts[2]
    const options = (newData.options as Array<Record<string, unknown>>) || []
    if (options[index]) {
      const value = String(options[index][field] || '')
      const flags = caseSensitive ? 'g' : 'gi'
      options[index][field] = value.replace(new RegExp(escapeRegExp(searchText), flags), replaceText)
    }
  }

  return newData
}

function highlightText(text: string, query: string, caseSensitive: boolean): React.ReactNode[] {
  if (!query) return [text]

  const flags = caseSensitive ? 'g' : 'gi'
  const regex = new RegExp(`(${escapeRegExp(query)})`, flags)
  const parts = text.split(regex)

  return parts.map((part, index) => {
    if (part.toLowerCase() === query.toLowerCase() && !caseSensitive) {
      return <mark key={index} className="bg-yellow-500/40 text-yellow-200 px-0.5 rounded">{part}</mark>
    }
    if (caseSensitive && part === query) {
      return <mark key={index} className="bg-yellow-500/40 text-yellow-200 px-0.5 rounded">{part}</mark>
    }
    return part
  })
}

export function NodeSearch({ nodes, characters, open, onClose, onReplaceNode }: NodeSearchProps) {
  const [query, setQuery] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const { setCenter } = useReactFlow()

  const matches = useMemo(() => {
    return findAllMatches(nodes, characters, query, caseSensitive)
  }, [query, nodes, characters, caseSensitive])

  const currentMatch = matches[selectedIndex]

  useEffect(() => {
    setSelectedIndex(0)
  }, [query, caseSensitive])

  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
      setQuery('')
      setReplaceText('')
      setSelectedIndex(0)
    }
  }, [open])

  const navigateToMatch = useCallback((match: SearchMatch) => {
    const node = nodes.find(n => n.id === match.nodeId)
    if (node) {
      setCenter(node.position.x + 100, node.position.y + 50, { zoom: 1.5, duration: 300 })
    }
  }, [nodes, setCenter])

  const goToNext = useCallback(() => {
    if (matches.length === 0) return
    setSelectedIndex(prev => (prev + 1) % matches.length)
  }, [matches.length])

  const goToPrev = useCallback(() => {
    if (matches.length === 0) return
    setSelectedIndex(prev => (prev - 1 + matches.length) % matches.length)
  }, [matches.length])

  const replaceCurrent = useCallback(() => {
    if (!currentMatch || !onReplaceNode) return

    const node = nodes.find(n => n.id === currentMatch.nodeId)
    if (!node) return

    const nodeData = node.data as Record<string, unknown>
    const newData = updateNodeDataWithReplace(nodeData, currentMatch.fieldPath, query, replaceText, caseSensitive)

    onReplaceNode(currentMatch.nodeId, newData as Partial<StoryNode['data']>)
  }, [currentMatch, nodes, query, replaceText, caseSensitive, onReplaceNode])

  const replaceAll = useCallback(() => {
    if (!onReplaceNode || matches.length === 0) return

    const nodeUpdates = new Map<string, Record<string, unknown>>()

    for (const match of matches) {
      const node = nodes.find(n => n.id === match.nodeId)
      if (!node) continue

      let currentData = nodeUpdates.get(match.nodeId)
      if (!currentData) {
        currentData = { ...(node.data as Record<string, unknown>) }
      }

      currentData = updateNodeDataWithReplace(currentData, match.fieldPath, query, replaceText, caseSensitive)
      nodeUpdates.set(match.nodeId, currentData)
    }

    nodeUpdates.forEach((data, nodeId) => {
      onReplaceNode(nodeId, data as Partial<StoryNode['data']>)
    })
  }, [matches, nodes, query, replaceText, caseSensitive, onReplaceNode])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        goToPrev()
      } else {
        goToNext()
      }
    } else if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      goToNext()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      goToPrev()
    }
  }, [goToNext, goToPrev, onClose])

  const handleReplaceKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      replaceCurrent()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [replaceCurrent, onClose])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return
        }
        e.preventDefault()
        if (!open) {
          window.dispatchEvent(new CustomEvent('subsilicon-node-search-open'))
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return
        }
        e.preventDefault()
        if (!open) {
          window.dispatchEvent(new CustomEvent('subsilicon-node-search-open'))
          setTimeout(() => setShowReplace(true), 50)
        } else {
          setShowReplace(true)
          setTimeout(() => replaceInputRef.current?.focus(), 50)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-20 z-50">
      <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="搜索节点文本..."
            className="flex-1 bg-transparent border-none text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          {query && matches.length > 0 && (
            <span className="text-xs text-slate-400 font-mono">
              {selectedIndex + 1} / {matches.length}
            </span>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCaseSensitive(!caseSensitive)}
              className={`p-1 rounded text-xs font-mono transition-colors ${
                caseSensitive ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="区分大小写"
            >
              Aa
            </button>
            <button
              onClick={goToPrev}
              disabled={matches.length === 0}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              title="上一个 (Shift+Enter)"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={goToNext}
              disabled={matches.length === 0}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              title="下一个 (Enter)"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="border-b border-slate-700">
          <button
            onClick={() => setShowReplace(!showReplace)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
          >
            <Replace className="w-3.5 h-3.5" />
            <span>替换</span>
            {showReplace ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
          </button>

          {showReplace && (
            <div className="px-3 pb-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-12 text-xs text-slate-500">替换为</span>
                <input
                  ref={replaceInputRef}
                  type="text"
                  value={replaceText}
                  onChange={e => setReplaceText(e.target.value)}
                  onKeyDown={handleReplaceKeyDown}
                  placeholder="替换文本..."
                  className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={replaceCurrent}
                  disabled={!currentMatch || !onReplaceNode}
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  替换
                </button>
                <button
                  onClick={replaceAll}
                  disabled={matches.length === 0 || !onReplaceNode}
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  全部替换 ({matches.length})
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {query && matches.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              未找到匹配的内容
            </div>
          )}
          {!query && (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              输入关键词搜索节点文本
              <div className="mt-2 text-xs text-slate-600">
                支持：对话、旁白、选择、结局、付费、CG、跳转、随机、条件、汇聚
              </div>
            </div>
          )}
          {matches.map((match, index) => {
            const isSelected = index === selectedIndex
            const typeLabel = nodeTypeLabels[match.nodeType] || match.nodeType

            return (
              <button
                key={`${match.nodeId}-${match.fieldPath}-${index}`}
                onClick={() => {
                  setSelectedIndex(index)
                  navigateToMatch(match)
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full flex flex-col gap-1 px-3 py-2.5 text-left transition-colors ${
                  isSelected
                    ? 'bg-slate-700/80'
                    : 'hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 font-mono shrink-0">
                    {typeLabel}
                  </span>
                  <span className="text-xs text-slate-400 shrink-0">
                    {match.fieldLabel}
                  </span>
                  <span className="text-sm text-white truncate flex-1">
                    {match.nodeTitle}
                  </span>
                  {match.characterName && (
                    <span className="text-xs text-slate-500 truncate max-w-[100px]">
                      {match.characterName}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 pl-1 font-mono break-all">
                  {highlightText(match.beforeText, query, caseSensitive)}
                  <span className="bg-yellow-500/40 text-yellow-200 px-0.5 rounded">
                    {match.matchText}
                  </span>
                  {highlightText(match.afterText, query, caseSensitive)}
                </div>
              </button>
            )
          })}
        </div>

        {query && matches.length > 0 && (
          <div className="px-3 py-1.5 border-t border-slate-700 text-[10px] text-slate-500 flex items-center justify-between">
            <span>{matches.length} 个匹配结果</span>
            <div className="flex items-center gap-0.5">
              <CornerDownLeft className="w-3 h-3" />
              <span>下一个</span>
              <span className="mx-1">·</span>
              <span>Shift+Enter 上一个</span>
              <span className="mx-1">·</span>
              <span>Esc 关闭</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

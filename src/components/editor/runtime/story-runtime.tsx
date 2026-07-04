'use client'

import { useState, useCallback } from 'react'
import { Button } from '@editor/components/ui/button'
import { Card, CardContent } from '@editor/components/ui/card'
import { Lock, QrCode } from 'lucide-react'
import type { StoryGraph, StoryNode, StoryEdge } from '@editor/types/editor'

interface StoryRuntimeProps {
  storyGraph: StoryGraph
  workId: string
}

export function StoryRuntime({ storyGraph, workId }: StoryRuntimeProps) {
  const [currentNodeId, setCurrentNodeId] = useState<string>(() => {
    const startNode = storyGraph.nodes.find(
      (n) => n.type === 'dialogue' || n.type === 'choice'
    )
    return startNode?.id || storyGraph.nodes[0]?.id || ''
  })

  const [showQr, setShowQr] = useState(false)
  const [unlockedNodes, setUnlockedNodes] = useState<Set<string>>(new Set())

  const currentNode = storyGraph.nodes.find((n) => n.id === currentNodeId) as StoryNode | undefined

  const getNextNodeId = useCallback(
    (nodeId: string, optionIndex?: number): string | undefined => {
      const outgoing = storyGraph.edges.filter((e: StoryEdge) => e.source === nodeId)
      if (outgoing.length === 0) return undefined
      if (optionIndex !== undefined && outgoing[optionIndex]) {
        return outgoing[optionIndex].target
      }
      return outgoing[0].target
    },
    [storyGraph.edges]
  )

  const handleChoice = (optionIndex: number) => {
    const nextId = getNextNodeId(currentNodeId, optionIndex)
    if (nextId) setCurrentNodeId(nextId)
  }

  const handleUnlock = () => {
    // 模拟支付解锁
    setShowQr(true)
    setTimeout(() => {
      setShowQr(false)
      setUnlockedNodes((prev) => new Set(prev).add(currentNodeId))
      const nextId = getNextNodeId(currentNodeId)
      if (nextId) setCurrentNodeId(nextId)
    }, 2000)
  }

  const handleContinue = () => {
    const nextId = getNextNodeId(currentNodeId)
    if (nextId) setCurrentNodeId(nextId)
  }

  if (!currentNode) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>故事尚未开始或已结束</p>
      </div>
    )
  }

  const { type, data } = currentNode

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 gap-4">
      {type === 'dialogue' && (
        <Card className="w-full max-w-lg">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                {(data as any).characterId?.slice(0, 2) || '?'}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {storyGraph.characters.find((c) => c.id === (data as any).characterId)?.name || '未知角色'}
                </p>
                {(data as any).emotion && (
                  <p className="text-xs text-muted-foreground">{(data as any).emotion}</p>
                )}
              </div>
            </div>
            <p className="text-base leading-relaxed">{(data as any).text || '...'}</p>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleContinue}>
                继续
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {type === 'choice' && (
        <div className="w-full max-w-lg space-y-3">
          <p className="text-center text-sm text-muted-foreground mb-2">你的选择</p>
          {((data as any).options || []).map((opt: any, i: number) => (
            <Button
              key={opt.id || i}
              variant="outline"
              className="w-full justify-start text-left h-auto py-3 px-4"
              onClick={() => handleChoice(i)}
            >
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium shrink-0 mr-3">
                {String.fromCharCode(65 + i)}
              </span>
              <span>{opt.text || `选项 ${i + 1}`}</span>
            </Button>
          ))}
        </div>
      )}

      {type !== 'dialogue' && type !== 'choice' && (
        <div className="text-muted-foreground">
          <p>暂不支持的节点类型: {type}</p>
          <Button size="sm" className="mt-4" onClick={handleContinue}>
            继续
          </Button>
        </div>
      )}
    </div>
  )
}

import type { StoryNode, StoryEdge, StoryCharacter } from '@editor/types/editor'
import type { AiOutlineResult, OutlineScene } from './ai-service'

export interface OutlineToCanvasResult {
  nodes: StoryNode[]
  edges: StoryEdge[]
}

const CHARACTER_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#06b6d4'
]

export function convertOutlineToCanvas(
  outline: AiOutlineResult,
  options: { startX?: number; startY?: number } = {}
): OutlineToCanvasResult {
  const nodes: StoryNode[] = []
  const edges: StoryEdge[] = []

  const { startX = 400, startY = 100 } = options
  const nodeWidth = 280
  const nodeHeight = 120
  const hGap = 100
  const vGap = 80

  const sceneNodeMap = new Map<string, string>()
  let nodeCounter = 0

  const createNodeId = (prefix: string): string => {
    nodeCounter += 1
    return `${prefix}-${Date.now()}-${nodeCounter}`
  }

  const scenes = outline.scenes || []

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    const isEnding = i === scenes.length - 1 && (!scene.choices || scene.choices.length === 0)
    const hasChoices = scene.choices && scene.choices.length > 0

    if (isEnding) {
      const nodeId = createNodeId('ending')
      sceneNodeMap.set(scene.id, nodeId)

      nodes.push({
        id: nodeId,
        type: 'ending',
        position: { x: startX, y: startY + i * (nodeHeight + vGap) },
        data: {
          title: scene.title || '结局',
          text: scene.description || '',
          endingType: 'neutral' as const,
        },
      })
    } else if (hasChoices) {
      const nodeId = createNodeId('choice')
      sceneNodeMap.set(scene.id, nodeId)

      const options = (scene.choices || []).map((choice, idx) => ({
        id: `opt-${idx}`,
        text: choice.text || `选项 ${idx + 1}`,
      }))

      nodes.push({
        id: nodeId,
        type: 'choice',
        position: { x: startX, y: startY + i * (nodeHeight + vGap) },
        data: {
          prompt: scene.title || '做出选择',
          options,
        },
      })
    } else {
      const nodeId = createNodeId('narration')
      sceneNodeMap.set(scene.id, nodeId)

      nodes.push({
        id: nodeId,
        type: 'narration',
        position: { x: startX, y: startY + i * (nodeHeight + vGap) },
        data: {
          text: scene.description || '',
          textAnimation: 'typewriter',
        },
      })
    }
  }

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    const currentNodeId = sceneNodeMap.get(scene.id)
    if (!currentNodeId) continue

    if (scene.choices && scene.choices.length > 0) {
      scene.choices.forEach((choice, idx) => {
        const targetNodeId = choice.nextSceneId
          ? sceneNodeMap.get(choice.nextSceneId)
          : undefined
        if (targetNodeId) {
          edges.push({
            id: `edge-${Date.now()}-c${i}-${idx}`,
            source: currentNodeId,
            target: targetNodeId,
            sourceHandle: `source-${idx}`,
            data: { label: choice.text },
          })
        }
      })
    } else if (i < scenes.length - 1) {
      const nextScene = scenes[i + 1]
      const nextNodeId = sceneNodeMap.get(nextScene.id)
      if (nextNodeId) {
        edges.push({
          id: `edge-${Date.now()}-s${i}`,
          source: currentNodeId,
          target: nextNodeId,
        })
      }
    }
  }

  return { nodes, edges }
}

export function extractCharactersFromOutline(
  outline: AiOutlineResult
): StoryCharacter[] {
  const characterMap = new Map<string, { name: string; description: string }>()

  outline.scenes?.forEach((scene) => {
    if (scene.characters && scene.characters.length > 0) {
      scene.characters.forEach((char, idx) => {
        if (!characterMap.has(char)) {
          characterMap.set(char, { name: char, description: '' })
        }
      })
    }
  })

  const characters: StoryCharacter[] = []
  let colorIndex = 0

  characterMap.forEach((char, name) => {
    characters.push({
      id: `char-${Date.now()}-${name}`,
      name,
      avatar: '',
      color: CHARACTER_COLORS[colorIndex % CHARACTER_COLORS.length],
      gender: 'unknown',
      age: '',
      occupation: '',
      personality: [],
      appearance: [],
      background: '',
      speech: {
        tone: 'normal',
        catchphrases: [],
      },
      skills: [],
      motivation: '',
      habits: [],
      fears: [],
      relations: [],
      tags: [],
      bio: '',
      sprites: [],
    })
    colorIndex++
  })

  return characters
}

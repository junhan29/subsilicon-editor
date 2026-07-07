import type { AiFullStoryResult, AiCharacter, OutlineScene } from './ai-service'
import type { StoryNode, StoryEdge, StoryCharacter } from '@editor/types/editor'

export interface StoryConversionResult {
  nodes: StoryNode[]
  edges: StoryEdge[]
  characters: StoryCharacter[]
}

const CHARACTER_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#06b6d4'
]

export function convertAiStoryToGraph(story: AiFullStoryResult): StoryConversionResult {
  const nodes: StoryNode[] = []
  const edges: StoryEdge[] = []
  const characters: StoryCharacter[] = []

  const charColorMap = new Map<string, string>()
  story.characters.forEach((char, index) => {
    charColorMap.set(char.name, CHARACTER_COLORS[index % CHARACTER_COLORS.length])
  })

  story.characters.forEach((char) => {
    const character: StoryCharacter = {
      id: char.id,
      name: char.name,
      avatar: '',
      color: charColorMap.get(char.name) || '#3b82f6',
      gender: char.gender,
      age: char.age,
      occupation: char.occupation,
      personality: char.personality,
      appearance: char.appearance,
      background: char.background,
      speech: {
        tone: char.speech.tone,
        catchphrases: char.speech.catchphrases,
      },
      skills: [],
      motivation: char.motivation,
      habits: [],
      fears: [],
      relations: [],
      tags: [],
      bio: char.bio,
      sprites: [],
    }
    characters.push(character)
  })

  const sceneNodeMap = new Map<string, string>()
  let nodeCounter = 0

  const createNodeId = (prefix: string): string => {
    nodeCounter += 1
    return `${prefix}-${Date.now()}-${nodeCounter}`
  }

  let currentX = 400
  let currentY = 100
  const nodeWidth = 280
  const nodeHeight = 120
  const hGap = 80
  const vGap = 60

  for (let i = 0; i < story.scenes.length; i++) {
    const scene = story.scenes[i]
    const isEnding = i === story.scenes.length - 1
    
    if (isEnding) {
      const nodeId = createNodeId('ending')
      sceneNodeMap.set(scene.id, nodeId)
      
      nodes.push({
        id: nodeId,
        type: 'ending',
        position: { x: currentX, y: currentY },
        data: {
          title: scene.title,
          text: scene.description,
          endingType: 'neutral' as const,
        },
      })
    } else if (scene.choices && scene.choices.length > 0) {
      const nodeId = createNodeId('choice')
      sceneNodeMap.set(scene.id, nodeId)
      
      const options = scene.choices.map((choice, idx) => ({
        id: `opt-${idx}`,
        text: choice.text,
        nextNodeId: choice.nextSceneId ? sceneNodeMap.get(choice.nextSceneId) : undefined,
      }))
      
      nodes.push({
        id: nodeId,
        type: 'choice',
        position: { x: currentX, y: currentY },
        data: {
          prompt: scene.title,
          options,
        },
      })
      
      if (scene.choices.length > 0) {
        const maxScenesInBranch = Math.max(
          ...scene.choices.map((c) => {
            const targetIdx = story.scenes.findIndex((s) => s.id === c.nextSceneId)
            return targetIdx >= 0 ? story.scenes.length - targetIdx : 1
          })
        )
        
        currentX += nodeWidth + hGap
        const branchHeight = (maxScenesInBranch - 1) * (nodeHeight + vGap)
        
        scene.choices.forEach((choice, choiceIdx) => {
          let branchY = currentY + (choiceIdx * branchHeight) / Math.max(scene.choices.length - 1, 1)
          const targetIdx = story.scenes.findIndex((s) => s.id === choice.nextSceneId)
          
          if (targetIdx >= 0) {
            for (let j = targetIdx; j < story.scenes.length; j++) {
              const targetScene = story.scenes[j]
              const isBranchEnding = j === story.scenes.length - 1
              
              if (isBranchEnding) {
                const endingNodeId = createNodeId('ending')
                sceneNodeMap.set(targetScene.id, endingNodeId)
                
                nodes.push({
                  id: endingNodeId,
                  type: 'ending',
                  position: { x: currentX, y: branchY },
                  data: {
                    title: targetScene.title,
                    text: targetScene.description,
                    endingType: 'neutral' as const,
                  },
                })
              } else if (!targetScene.choices || targetScene.choices.length === 0) {
                const narrNodeId = createNodeId('narration')
                sceneNodeMap.set(targetScene.id, narrNodeId)
                
                nodes.push({
                  id: narrNodeId,
                  type: 'narration',
                  position: { x: currentX, y: branchY },
                  data: {
                    text: targetScene.description,
                    textAnimation: 'typewriter',
                  },
                })
                
                branchY += nodeHeight + vGap
              } else {
                const choiceNodeId = createNodeId('choice')
                sceneNodeMap.set(targetScene.id, choiceNodeId)
                
                const opts = targetScene.choices!.map((ch, idx) => ({
                  id: `opt-${idx}`,
                  text: ch.text,
                  nextNodeId: ch.nextSceneId ? sceneNodeMap.get(ch.nextSceneId) : undefined,
                }))
                
                nodes.push({
                  id: choiceNodeId,
                  type: 'choice',
                  position: { x: currentX, y: branchY },
                  data: {
                    prompt: targetScene.title,
                    options: opts,
                  },
                })
                
                branchY += nodeHeight + vGap
              }
            }
          }
        })
        
        currentX -= nodeWidth + hGap
      }
    } else {
      const nodeId = createNodeId('narration')
      sceneNodeMap.set(scene.id, nodeId)
      
      nodes.push({
        id: nodeId,
        type: 'narration',
        position: { x: currentX, y: currentY },
        data: {
          text: scene.description,
          textAnimation: 'typewriter',
        },
      })
    }
    
    currentY += nodeHeight + vGap
  }

  for (let i = 0; i < story.scenes.length; i++) {
    const scene = story.scenes[i]
    const currentNodeId = sceneNodeMap.get(scene.id)
    
    if (currentNodeId) {
      if (scene.choices && scene.choices.length > 0) {
        scene.choices.forEach((choice, idx) => {
          const targetNodeId = choice.nextSceneId ? sceneNodeMap.get(choice.nextSceneId) : undefined
          if (targetNodeId) {
            edges.push({
              id: `edge-${Date.now()}-${idx}`,
              source: currentNodeId,
              target: targetNodeId,
              sourceHandle: `source-${idx}`,
            })
          }
        })
      } else if (i < story.scenes.length - 1) {
        const nextScene = story.scenes[i + 1]
        const nextNodeId = sceneNodeMap.get(nextScene.id)
        if (nextNodeId) {
          edges.push({
            id: `edge-${Date.now()}-${i}`,
            source: currentNodeId,
            target: nextNodeId,
          })
        }
      }
    }
  }

  return { nodes, edges, characters }
}

export function convertAiCharacterToStoryCharacter(char: AiCharacter): StoryCharacter {
  return {
    id: char.id,
    name: char.name,
    avatar: '',
    color: CHARACTER_COLORS[Math.floor(Math.random() * CHARACTER_COLORS.length)],
    gender: char.gender,
    age: char.age,
    occupation: char.occupation,
    personality: char.personality,
    appearance: char.appearance,
    background: char.background,
    speech: {
      tone: char.speech.tone,
      catchphrases: char.speech.catchphrases,
      rhythm: undefined,
      vocabulary: undefined,
    },
    skills: [],
    motivation: char.motivation,
    habits: [],
    fears: [],
    relations: [],
    tags: [],
    bio: char.bio,
    sprites: [],
  }
}

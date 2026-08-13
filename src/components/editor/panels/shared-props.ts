'use client'

import type { ComicScene, StoryCharacter, StoryEdge, StoryNode, StoryVariable } from '@editor/types/editor'
import {
  DIALOG_COLOR_OPTIONS,
  DIALOG_STYLE_TYPES,
  EMOTION_TYPES,
  ENDING_TYPES,
  ENTER_ANIMATION_TYPES,
  NODE_TYPE_LABELS,
  SPRITE_POSITION_TYPES,
  TEXT_ANIMATION_TYPES,
  TRANSITION_TYPES,
} from '@editor/constants'

export {
  NODE_TYPE_LABELS,
  ENDING_TYPES,
  EMOTION_TYPES,
  TRANSITION_TYPES,
  TEXT_ANIMATION_TYPES,
  ENTER_ANIMATION_TYPES,
  SPRITE_POSITION_TYPES,
  DIALOG_STYLE_TYPES,
  DIALOG_COLOR_OPTIONS,
}

export interface BasePanelProps {
  node: StoryNode
  characters: StoryCharacter[]
  variables?: StoryVariable[]
  assets?: { images: string[]; audios: string[]; fonts: string[] }
  scenes?: ComicScene[]
  onUpdateNode: (nodeId: string, data: Partial<StoryNode['data']>) => void
  onDeleteNode: (nodeId: string) => void
  onOpenAssets?: (tab?: 'images' | 'audios' | 'video') => void
}

export interface EdgePanelProps {
  edge: StoryEdge
  onUpdateEdge: (edgeId: string, data: Partial<StoryEdge>) => void
  onDeleteEdge: (edgeId: string) => void
}
'use client'

import type { StoryNode, StoryCharacter, StoryEdge, StoryVariable, ComicScene } from '@editor/types/editor'
import {
  NODE_TYPE_LABELS,
  ENDING_TYPES,
  EMOTION_TYPES,
  TRANSITION_TYPES,
  TEXT_ANIMATION_TYPES,
  ENTER_ANIMATION_TYPES,
  SPRITE_POSITION_TYPES,
  DIALOG_STYLE_TYPES,
  DIALOG_COLOR_OPTIONS,
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
  onOpenAssets?: (tab?: 'images' | 'audios') => void
}

export interface EdgePanelProps {
  edge: StoryEdge
  onUpdateEdge: (edgeId: string, data: Partial<StoryEdge>) => void
  onDeleteEdge: (edgeId: string) => void
}
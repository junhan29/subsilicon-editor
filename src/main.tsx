import React from 'react'
import ReactDOM from 'react-dom/client'
import { StoryCanvas } from './components/editor/story-canvas'
import type { StoryGraph } from './types/editor'
import './index.css'

const emptyGraph: StoryGraph = {
  title: '未命名故事',
  description: '',
  templateId: 'custom',
  characters: [],
  variables: [],
  nodes: [],
  edges: [],
  settings: {
    title: '未命名故事',
    tags: [],
  },
  assets: {
    images: [],
    audios: [],
    fonts: [],
  },
  scenes: [],
  audios: [],
  groups: [],
  annotations: [],
}

function handleSave(graph: StoryGraph): void {
  console.log('[Editor] Save story:', graph.title)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoryCanvas initialGraph={emptyGraph} onSave={handleSave} />
  </React.StrictMode>
)

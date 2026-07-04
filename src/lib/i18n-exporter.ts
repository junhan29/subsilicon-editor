import type { StoryGraph, StoryNode, StoryCharacter, ComicScene, StoryVariable } from '@editor/types/editor'

export type TextCategory =
  | 'dialogue'
  | 'narration'
  | 'choice'
  | 'ending'
  | 'cg'
  | 'character'
  | 'scene'
  | 'variable'

export interface TranslatableText {
  id: string
  nodeId: string
  nodeType: string
  category: TextCategory
  sourceText: string
  context?: string
  characterName?: string
}

export interface TranslationTable {
  version: 1
  sourceLanguage: string
  targetLanguage: string
  workName: string
  exportedAt: number
  totalTexts: number
  categories: Record<string, number>
  texts: TranslatableText[]
}

const LANGUAGE_NAMES: Record<string, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'en-US': 'English',
  'ja-JP': '日本語',
  'ko-KR': '한국어',
  'fr-FR': 'Français',
  'de-DE': 'Deutsch',
  'es-ES': 'Español',
  'pt-BR': 'Português',
  'ru-RU': 'Русский',
  'ar-SA': 'العربية',
  'th-TH': 'ไทย',
  'vi-VN': 'Tiếng Việt',
  'id-ID': 'Bahasa Indonesia',
}

export const SUPPORTED_LANGUAGES = Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({
  code,
  name,
}))

function getCharacterNameById(characters: StoryCharacter[], id: string): string {
  const char = characters.find((c) => c.id === id)
  return char?.name || ''
}

export function extractTexts(graph: StoryGraph): TranslatableText[] {
  const texts: TranslatableText[] = []
  const { nodes = [], characters = [], scenes = [], variables = [] } = graph

  for (const node of nodes) {
    const data = node.data as Record<string, unknown>

    switch (node.type) {
      case 'dialogue': {
        const text = String(data.text || '')
        if (text.trim()) {
          const characterId = String(data.characterId || '')
          const characterName = getCharacterNameById(characters, characterId)
          texts.push({
            id: `node_${node.id}_text`,
            nodeId: node.id,
            nodeType: node.type,
            category: 'dialogue',
            sourceText: text,
            characterName,
            context: characterName ? `${characterName} 的台词` : '对话台词',
          })
        }
        break
      }

      case 'narration': {
        const text = String(data.text || '')
        if (text.trim()) {
          texts.push({
            id: `node_${node.id}_text`,
            nodeId: node.id,
            nodeType: node.type,
            category: 'narration',
            sourceText: text,
            context: '旁白/叙述文本',
          })
        }
        break
      }

      case 'choice': {
        const options = Array.isArray(data.options) ? data.options : []
        options.forEach((opt: any, index: number) => {
          const text = String(opt.text || '')
          if (text.trim()) {
            texts.push({
              id: `node_${node.id}_option_${index}`,
              nodeId: node.id,
              nodeType: node.type,
              category: 'choice',
              sourceText: text,
              context: `分支选择第 ${index + 1} 个选项`,
            })
          }
        })
        break
      }

      case 'ending': {
        const title = String(data.title || '')
        if (title.trim()) {
          texts.push({
            id: `node_${node.id}_title`,
            nodeId: node.id,
            nodeType: node.type,
            category: 'ending',
            sourceText: title,
            context: '结局标题',
          })
        }
        const text = String(data.text || '')
        if (text.trim()) {
          texts.push({
            id: `node_${node.id}_text`,
            nodeId: node.id,
            nodeType: node.type,
            category: 'ending',
            sourceText: text,
            context: '结局描述文本',
          })
        }
        break
      }

      case 'cg': {
        const title = String(data.title || '')
        if (title.trim()) {
          texts.push({
            id: `node_${node.id}_title`,
            nodeId: node.id,
            nodeType: node.type,
            category: 'cg',
            sourceText: title,
            context: 'CG过场动画标题',
          })
        }
        const subtitle = String(data.subtitle || '')
        if (subtitle.trim()) {
          texts.push({
            id: `node_${node.id}_subtitle`,
            nodeId: node.id,
            nodeType: node.type,
            category: 'cg',
            sourceText: subtitle,
            context: 'CG过场动画副标题',
          })
        }
        break
      }
    }
  }

  for (const char of characters) {
    if (char.name?.trim()) {
      texts.push({
        id: `char_${char.id}_name`,
        nodeId: char.id,
        nodeType: 'character',
        category: 'character',
        sourceText: char.name,
        context: '角色名称',
      })
    }
  }

  for (const scene of scenes) {
    if (scene.name?.trim()) {
      texts.push({
        id: `scene_${scene.id}_name`,
        nodeId: scene.id,
        nodeType: 'scene',
        category: 'scene',
        sourceText: scene.name,
        context: '场景名称',
      })
    }
  }

  for (const variable of variables) {
    if (variable.name?.trim()) {
      texts.push({
        id: `var_${variable.name}_name`,
        nodeId: variable.name,
        nodeType: 'variable',
        category: 'variable',
        sourceText: variable.name,
        context: '变量名称',
      })
    }
    const desc = (variable as any).description
    if (desc && typeof desc === 'string' && desc.trim()) {
      texts.push({
        id: `var_${variable.name}_desc`,
        nodeId: variable.name,
        nodeType: 'variable',
        category: 'variable',
        sourceText: desc,
        context: '变量描述',
      })
    }
  }

  return texts
}

export function exportTranslationTable(
  graph: StoryGraph,
  sourceLang: string = 'zh-CN',
  workName: string = ''
): TranslationTable {
  const texts = extractTexts(graph)
  const categories: Record<string, number> = {}

  for (const t of texts) {
    categories[t.category] = (categories[t.category] || 0) + 1
  }

  return {
    version: 1,
    sourceLanguage: sourceLang,
    targetLanguage: '',
    workName: workName || graph.title || '未命名故事',
    exportedAt: Date.now(),
    totalTexts: texts.length,
    categories,
    texts,
  }
}

export function exportToJSON(table: TranslationTable): string {
  return JSON.stringify(table, null, 2)
}

function escapeCSV(text: string): string {
  if (text.includes(',') || text.includes('"') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function exportToCSV(table: TranslationTable): string {
  const headers = ['id', 'category', 'sourceText', 'targetText', 'context', 'characterName', 'nodeId']
  const lines = [headers.join(',')]

  for (const t of table.texts) {
    const row = [
      escapeCSV(t.id),
      escapeCSV(t.category),
      escapeCSV(t.sourceText),
      '',
      escapeCSV(t.context || ''),
      escapeCSV(t.characterName || ''),
      escapeCSV(t.nodeId),
    ]
    lines.push(row.join(','))
  }

  return '\uFEFF' + lines.join('\n')
}

function escapeXML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function exportToXLIFF(table: TranslationTable): string {
  const now = new Date().toISOString()
  const sourceLang = table.sourceLanguage
  const targetLang = table.targetLanguage || 'en-US'

  let body = ''
  for (let i = 0; i < table.texts.length; i++) {
    const t = table.texts[i]
    body += `
        <trans-unit id="${escapeXML(t.id)}">
          <source xml:lang="${sourceLang}">${escapeXML(t.sourceText)}</source>
          <target xml:lang="${targetLang}"></target>
          <note from="context">${escapeXML(t.context || '')}</note>
          ${t.characterName ? `<note from="character">${escapeXML(t.characterName)}</note>` : ''}
          <note from="nodeId">${escapeXML(t.nodeId)}</note>
          <note from="category">${escapeXML(t.category)}</note>
        </trans-unit>`
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file
    source-language="${sourceLang}"
    target-language="${targetLang}"
    datatype="plaintext"
    original="${escapeXML(table.workName)}"
    date="${now}">
    <header>
      <tool tool-id="subsilicon" tool-name="SubSilicon Editor" tool-version="1.0"/>
      <note>Exported from SubSilicon Editor - ${escapeXML(table.workName)}</note>
    </header>
    <body>${body}
    </body>
  </file>
</xliff>`
}

export interface ImportResult {
  success: boolean
  appliedCount: number
  skippedCount: number
  error?: string
  newGraph: StoryGraph
}

export function importTranslationTable(
  graph: StoryGraph,
  translatedTable: TranslationTable
): ImportResult {
  const newGraph: StoryGraph = JSON.parse(JSON.stringify(graph))
  const { nodes = [], characters = [], scenes = [], variables = [] } = newGraph

  let appliedCount = 0
  let skippedCount = 0

  const textMap = new Map<string, string>()
  for (const t of translatedTable.texts) {
    const translated = (t as any).targetText
    if (translated && typeof translated === 'string' && translated.trim()) {
      textMap.set(t.id, translated)
    }
  }

  for (const node of nodes as StoryNode[]) {
    const data = node.data as Record<string, any>

    switch (node.type) {
      case 'dialogue': {
        const id = `node_${node.id}_text`
        if (textMap.has(id)) {
          data.text = textMap.get(id)!
          appliedCount++
        }
        break
      }

      case 'narration': {
        const id = `node_${node.id}_text`
        if (textMap.has(id)) {
          data.text = textMap.get(id)!
          appliedCount++
        }
        break
      }

      case 'choice': {
        const options = Array.isArray(data.options) ? data.options : []
        options.forEach((opt: any, index: number) => {
          const id = `node_${node.id}_option_${index}`
          if (textMap.has(id)) {
            opt.text = textMap.get(id)!
            appliedCount++
          }
        })
        break
      }

      case 'ending': {
        const titleId = `node_${node.id}_title`
        if (textMap.has(titleId)) {
          data.title = textMap.get(titleId)!
          appliedCount++
        }
        const textId = `node_${node.id}_text`
        if (textMap.has(textId)) {
          data.text = textMap.get(textId)!
          appliedCount++
        }
        break
      }

      case 'cg': {
        const titleId = `node_${node.id}_title`
        if (textMap.has(titleId)) {
          data.title = textMap.get(titleId)!
          appliedCount++
        }
        const subtitleId = `node_${node.id}_subtitle`
        if (textMap.has(subtitleId)) {
          data.subtitle = textMap.get(subtitleId)!
          appliedCount++
        }
        break
      }
    }
  }

  for (const char of characters as StoryCharacter[]) {
    const id = `char_${char.id}_name`
    if (textMap.has(id)) {
      char.name = textMap.get(id)!
      appliedCount++
    }
  }

  for (const scene of scenes as ComicScene[]) {
    const id = `scene_${scene.id}_name`
    if (textMap.has(id)) {
      scene.name = textMap.get(id)!
      appliedCount++
    }
  }

  for (const variable of variables as StoryVariable[]) {
    const nameId = `var_${variable.name}_name`
    if (textMap.has(nameId)) {
      variable.name = textMap.get(nameId)!
      appliedCount++
    }
    const descId = `var_${variable.name}_desc`
    if (textMap.has(descId)) {
      (variable as any).description = textMap.get(descId)!
      appliedCount++
    }
  }

  skippedCount = textMap.size - appliedCount
  if (skippedCount < 0) skippedCount = 0

  return {
    success: true,
    appliedCount,
    skippedCount,
    newGraph,
  }
}

export function parseTranslationTable(content: string): TranslationTable | null {
  try {
    const parsed = JSON.parse(content)
    if (parsed && parsed.version === 1 && Array.isArray(parsed.texts)) {
      return parsed as TranslationTable
    }
    return null
  } catch {
    return null
  }
}

export function parseCSVTranslation(content: string): TranslationTable | null {
  try {
    const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
    if (lines.length < 2) return null

    const parseLine = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"'
            i++
          } else {
            inQuotes = !inQuotes
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current)
          current = ''
        } else {
          current += char
        }
      }
      result.push(current)
      return result
    }

    const headers = parseLine(lines[0])
    const texts: TranslatableText[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i])
      const obj: Record<string, string> = {}
      headers.forEach((h, idx) => {
        obj[h] = values[idx] || ''
      })

      if (obj.id && obj.sourceText) {
        texts.push({
          id: obj.id,
          nodeId: obj.nodeId || '',
          nodeType: '',
          category: (obj.category as any) || 'dialogue',
          sourceText: obj.sourceText,
          context: obj.context,
          characterName: obj.characterName,
          ...(obj.targetText ? { targetText: obj.targetText } : {}),
        } as any)
      }
    }

    const categories: Record<string, number> = {}
    for (const t of texts) {
      categories[t.category] = (categories[t.category] || 0) + 1
    }

    return {
      version: 1,
      sourceLanguage: 'zh-CN',
      targetLanguage: '',
      workName: '导入的翻译表',
      exportedAt: Date.now(),
      totalTexts: texts.length,
      categories,
      texts,
    }
  } catch {
    return null
  }
}

export function countTotalCharacters(table: TranslationTable): number {
  return table.texts.reduce((sum, t) => sum + t.sourceText.length, 0)
}

export const CATEGORY_LABELS: Record<TextCategory, string> = {
  dialogue: '对话',
  narration: '旁白',
  choice: '选项',
  ending: '结局',
  cg: 'CG过场',
  character: '角色名',
  scene: '场景名',
  variable: '变量',
}

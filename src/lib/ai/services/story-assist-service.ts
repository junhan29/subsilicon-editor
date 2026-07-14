import type { AiConfig } from '../../ai/types'
import { callAi } from '../../ai/provider-registry'
import type { StoryNode, StoryEdge, StoryCharacter } from '@editor/types/editor'

export interface StoryBranchSuggestion {
  title: string
  description: string
  nodeType: string
  suggestedText: string
  emotionalImpact: string
}

export interface PlotSuggestion {
  summary: string
  branches: StoryBranchSuggestion[]
  characterDevelopment: string
  pacing: string
}

export async function suggestNextPlot(
  currentNodes: StoryNode[],
  currentEdges: StoryEdge[],
  characters: StoryCharacter[],
  context?: string,
  config?: AiConfig | null
): Promise<PlotSuggestion> {
  const nodeSummary = currentNodes.slice(-5).map(n => {
    const type = n.type
    const text = (n.data as any)?.text || (n.data as any)?.title || ''
    return `[${type}] ${text.slice(0, 50)}`
  }).join('\n')

  const charSummary = characters.map(c => `${c.name}(${c.gender === 'male' ? '男' : c.gender === 'female' ? '女' : '其他'}): ${c.personality?.join('、') || ''}`).join('\n')

  const systemPrompt = `你是一位专业的互动叙事设计师。请基于当前剧情节点和角色设定，提供后续剧情发展建议。

输出必须是严格的 JSON 格式：
{
  "summary": "对当前剧情的简要分析",
  "branches": [
    {
      "title": "分支标题",
      "description": "分支描述，50字左右",
      "nodeType": "节点类型：dialogue/narration/choice/ending",
      "suggestedText": "建议的节点内容",
      "emotionalImpact": "情感影响说明"
    }
  ],
  "characterDevelopment": "角色发展建议",
  "pacing": "节奏把控建议"
}

要求：
1. 提供 2-3 个不同的剧情分支建议
2. 每个分支要有独特的情感走向
3. 考虑已有角色的性格一致性
4. 节点内容要适合直接填入编辑器`

  const userPrompt = `当前剧情节点（最近5个）：
${nodeSummary}

角色设定：
${charSummary}

${context ? `额外要求：${context}` : ''}

请提供后续剧情建议。`

  const rawResult = await callAi(
    { systemPrompt, userPrompt, temperature: 0.85, maxTokens: 2000 },
    config
  )

  try {
    const jsonStr = rawResult.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(jsonStr)
    return {
      summary: parsed.summary || '暂无分析',
      branches: Array.isArray(parsed.branches) ? parsed.branches : [],
      characterDevelopment: parsed.characterDevelopment || '',
      pacing: parsed.pacing || '',
    }
  } catch {
    return {
      summary: '解析失败，请参考原始输出',
      branches: [],
      characterDevelopment: '',
      pacing: rawResult.slice(0, 200),
    }
  }
}

export async function generateNodeContent(
  nodeType: string,
  context: string,
  characters: StoryCharacter[],
  config?: AiConfig | null
): Promise<string> {
  const charList = characters.map(c => c.name).join('、')

  const systemPrompt = `你是一位专业的互动叙事编剧。请根据以下要求生成${nodeType === 'dialogue' ? '角色对话' : nodeType === 'narration' ? '旁白叙述' : nodeType === 'choice' ? '选项文本' : '剧情内容'}。

要求：
1. 内容要生动、有感染力
2. 符合互动叙事的节奏
3. 直接输出内容文本，不要添加解释
4. 控制在 200 字以内`

  const userPrompt = `节点类型：${nodeType}
上下文：${context}
可用角色：${charList || '无'}

请生成内容。`

  return callAi(
    { systemPrompt, userPrompt, temperature: 0.8, maxTokens: 800 },
    config
  )
}

export async function enhanceCharacter(
  character: StoryCharacter,
  enhancement: 'background' | 'personality' | 'speech' | 'appearance' | 'full',
  config?: AiConfig | null
): Promise<Partial<StoryCharacter>> {
  const systemPrompt = `你是一位专业的角色设计师。请基于以下角色信息，补充${
    enhancement === 'background' ? '背景故事' :
    enhancement === 'personality' ? '性格细节' :
    enhancement === 'speech' ? '说话风格' :
    enhancement === 'appearance' ? '外貌描写' : '完整设定'
  }。

输出必须是严格的 JSON 格式：
{
  ${enhancement === 'background' || enhancement === 'full' ? '"background": "背景故事，150字左右",' : ''}
  ${enhancement === 'personality' || enhancement === 'full' ? '"personality": ["性格特点1", "性格特点2", "性格特点3"],' : ''}
  ${enhancement === 'speech' || enhancement === 'full' ? '"speech": {"tone": "说话风格", "catchphrases": ["口头禅1", "口头禅2"]},' : ''}
  ${enhancement === 'appearance' || enhancement === 'full' ? '"appearance": ["外貌特征1", "外貌特征2", "外貌特征3"],' : ''}
  ${enhancement === 'full' ? '"bio": "完整角色简介，200字左右",' : ''}
}

直接输出 JSON，不要添加解释。`

  const userPrompt = `角色名称：${character.name}
性别：${character.gender === 'male' ? '男' : character.gender === 'female' ? '女' : '其他'}
年龄：${character.age || '未设定'}
职业：${character.occupation || '未设定'}
现有性格：${character.personality?.join('、') || '未设定'}
现有背景：${character.background || '未设定'}

请补充${enhancement === 'full' ? '完整的' : ''}角色设定。`

  const rawResult = await callAi(
    { systemPrompt, userPrompt, temperature: 0.75, maxTokens: 1200 },
    config
  )

  try {
    const jsonStr = rawResult.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(jsonStr)
    const result: Partial<StoryCharacter> = {}
    if (parsed.background) result.background = parsed.background
    if (Array.isArray(parsed.personality)) result.personality = parsed.personality
    if (parsed.speech) result.speech = parsed.speech
    if (Array.isArray(parsed.appearance)) result.appearance = parsed.appearance
    if (parsed.bio) result.bio = parsed.bio
    return result
  } catch {
    return {}
  }
}

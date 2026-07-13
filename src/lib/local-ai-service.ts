export interface OllamaConfig {
  baseUrl: string
  model: string
  temperature: number
  maxTokens: number
}

export interface OllamaModel {
  name: string
  model: string
  modified_at: string
  size: number
  digest: string
}

export interface OllamaCompletionRequest {
  model: string
  prompt: string
  system?: string
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

export interface OllamaCompletionResponse {
  model: string
  created_at: string
  response: string
  done: boolean
  context?: number[]
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: 'http://localhost:11434',
  model: 'deepseek-chat',
  temperature: 0.7,
  maxTokens: 2000,
}

let config = { ...DEFAULT_CONFIG }

export function setOllamaConfig(newConfig: Partial<OllamaConfig>): void {
  config = { ...config, ...newConfig }
}

export function getOllamaConfig(): OllamaConfig {
  return { ...config }
}

export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${config.baseUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function listModels(): Promise<OllamaModel[]> {
  try {
    const response = await fetch(`${config.baseUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`)
    }
    
    const data = await response.json()
    return data.models || []
  } catch (error) {
    console.warn('Failed to list models:', error)
    return []
  }
}

export async function generateCompletion(
  prompt: string,
  system?: string,
  options?: Partial<Pick<OllamaConfig, 'model' | 'temperature' | 'maxTokens'>>
): Promise<string> {
  const request: OllamaCompletionRequest = {
    model: options?.model || config.model,
    prompt,
    system,
    temperature: options?.temperature || config.temperature,
    max_tokens: options?.maxTokens || config.maxTokens,
    stream: false,
  }
  
  try {
    const response = await fetch(`${config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`)
    }
    
    const data: OllamaCompletionResponse = await response.json()
    return data.response || ''
  } catch (error) {
    console.warn('Ollama completion failed:', error)
    throw error
  }
}

export async function* generateCompletionStream(
  prompt: string,
  system?: string,
  options?: Partial<Pick<OllamaConfig, 'model' | 'temperature' | 'maxTokens'>>
): AsyncGenerator<string> {
  const request: OllamaCompletionRequest = {
    model: options?.model || config.model,
    prompt,
    system,
    temperature: options?.temperature || config.temperature,
    max_tokens: options?.maxTokens || config.maxTokens,
    stream: true,
  }
  
  try {
    const response = await fetch(`${config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`)
    }
    
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }
    
    const decoder = new TextDecoder()
    let buffer = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const data: OllamaCompletionResponse = JSON.parse(line)
            if (data.response) {
              yield data.response
            }
            if (data.done) {
              return
            }
          } catch {
          }
        }
      }
    }
  } catch (error) {
    console.warn('Ollama streaming completion failed:', error)
    throw error
  }
}

export async function pullModel(modelName: string): Promise<void> {
  try {
    const response = await fetch(`${config.baseUrl}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: modelName, stream: false }),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.status}`)
    }
  } catch (error) {
    console.warn('Failed to pull model:', error)
    throw error
  }
}

export async function createModel(modelName: string, modelfileContent: string): Promise<void> {
  try {
    const response = await fetch(`${config.baseUrl}/api/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: modelName, modelfile: modelfileContent, stream: false }),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to create model: ${response.status}`)
    }
  } catch (error) {
    console.warn('Failed to create model:', error)
    throw error
  }
}

export async function deleteModel(modelName: string): Promise<void> {
  try {
    const response = await fetch(`${config.baseUrl}/api/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: modelName }),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to delete model: ${response.status}`)
    }
  } catch (error) {
    console.warn('Failed to delete model:', error)
    throw error
  }
}

export async function generateStoryOutline(
  topic: string,
  genre: string,
  characterCount: number = 3,
  sceneCount: number = 5
): Promise<string> {
  const systemPrompt = `你是一个专业的互动叙事设计师。请根据以下主题和类型，生成一个完整的故事大纲，包含：
1. 故事标题
2. 故事简介（100字以内）
3. ${characterCount}个主要角色（每个角色包含：姓名、年龄、性格、背景、角色定位）
4. ${sceneCount}个主要场景（每个场景包含：场景名称、场景描述、关键情节、涉及角色）
5. 故事主线和分支路径说明

输出格式要求：
- 使用JSON格式输出
- 确保JSON格式正确，没有多余的文字
- 字段名：title, description, characters, scenes, mainPlot, branches`

  const prompt = `主题：${topic}
类型：${genre}
角色数量：${characterCount}
场景数量：${sceneCount}`

  return generateCompletion(prompt, systemPrompt)
}

export async function generateCharacterDetail(
  name: string,
  age: number,
  personality: string,
  background: string
): Promise<string> {
  const systemPrompt = `你是一个专业的角色设计师。请根据以下信息，生成详细的角色档案，包含：
1. 外貌描述
2. 性格特点（优缺点）
3. 动机和目标
4. 人际关系
5. 口头禅或标志性动作
6. 角色发展弧线

输出格式要求：
- 使用JSON格式输出
- 确保JSON格式正确
- 字段名：appearance, personalityTraits, motivations, relationships, catchphrase, characterArc`

  const prompt = `角色名称：${name}
年龄：${age}
性格：${personality}
背景：${background}`

  return generateCompletion(prompt, systemPrompt)
}

export async function generateDialogue(
  characterName: string,
  situation: string,
  emotion: string,
  targetLength: number = 50
): Promise<string> {
  const systemPrompt = `你是一个专业的编剧。请根据以下信息，生成一段对话或独白：
1. 角色名称
2. 场景情境
3. 情感状态
4. 目标长度（字数）

输出要求：
- 只输出对话内容，不要包含角色名称前缀
- 语言自然，符合角色性格
- 字数控制在${targetLength}字左右`

  const prompt = `角色：${characterName}
情境：${situation}
情感：${emotion}
目标长度：${targetLength}`

  return generateCompletion(prompt, systemPrompt)
}

export async function generateSceneDescription(
  sceneName: string,
  mood: string,
  timeOfDay: string,
  location: string
): Promise<string> {
  const systemPrompt = `你是一个专业的场景描写师。请根据以下信息，生成一段生动的场景描述：
1. 场景名称
2. 氛围/情绪
3. 时间
4. 地点

输出要求：
- 语言生动，画面感强
- 使用感官描写（视觉、听觉、嗅觉等）
- 控制在100-200字之间`

  const prompt = `场景名称：${sceneName}
氛围：${mood}
时间：${timeOfDay}
地点：${location}`

  return generateCompletion(prompt, systemPrompt)
}

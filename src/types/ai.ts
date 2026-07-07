export interface AiConfig {
  enabled: boolean
  providers: AiProviderConfig[]
  defaultProvider: string
  autoPolish: boolean
  autoPolishStyle: 'general' | 'vivid' | 'concise' | 'literary'
}

export interface AiProviderConfig {
  id: string
  name: string
  provider: 'openai' | 'anthropic' | 'deepseek' | 'google' | 'custom'
  apiKey: string
  apiUrl?: string
  model: string
  enabled: boolean
}

export type AiPolishStyle = 'general' | 'vivid' | 'concise' | 'literary'

export type AiProviderType = AiProviderConfig['provider']

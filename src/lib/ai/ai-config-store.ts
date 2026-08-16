/**
 * AI 配置本地存储（加密版）
 *
 * 集中处理 `subsilicon_ai_config` 的读写：保存前对全部 apiKey 做 AES-256
 * 加密，读取时返回原始存储值（密文）；需要明文的地方由调用方显式解密
 * （provider 请求 / UI 回显 / 测试连接）。
 */
import { encryptAiConfig, type ConfigLike } from './ai-key-vault'
import type { AiConfig } from '@editor/types/ai'

export const AI_CONFIG_STORAGE_KEY = 'subsilicon_ai_config'

/** 同步读取原始配置（apiKey 为密文或旧明文，不在此处解密） */
export function loadRawAiConfig(): AiConfig | null {
  try {
    const saved = localStorage.getItem(AI_CONFIG_STORAGE_KEY)
    return saved ? (JSON.parse(saved) as AiConfig) : null
  } catch {
    return null
  }
}

/** 加密全部 apiKey 后落盘（保存点统一走这里；兼容 flat 与 providers 数组格式） */
export async function saveAiConfigEncrypted(config: ConfigLike): Promise<void> {
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(await encryptAiConfig(config)))
}

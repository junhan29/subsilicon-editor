/**
 * AI 对话调试日志（Ai Debug Log）
 *
 * 记录每次 AI 对话的完整上下文：system prompt、画布上下文、用户输入、
 * AI 原始回复、解析出的命令、执行结果。供「调试面板」查看与回放。
 */

import type { ExecuteResult } from './chat-command-executor'

export interface AiDebugEntry {
  id: string
  timestamp: number
  userInput: string
  systemPrompt: string
  graphContext: string
  /** AI 原始回复全文（含 ai-action 代码块） */
  rawResponse: string
  /** 解析出的动作（未执行前的快照） */
  actions: unknown[]
  /** 是否启用了命令预览模式 */
  previewMode: boolean
  /** 预览模式下用户是否批准了执行 */
  approved?: boolean
  /** 执行结果 */
  execution?: ExecuteResult
  /** 预设规则命中情况 */
  automation?: string[]
}

const STORAGE_KEY = 'subsilicon.ai.debug.log.v1'
const MAX_ENTRIES = 50

function safeRead(): AiDebugEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as AiDebugEntry[]
  } catch {
    return []
  }
}

function safeWrite(entries: AiDebugEntry[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // 忽略（隐私模式 / 配额超限）
  }
}

export function appendDebugEntry(entry: AiDebugEntry): void {
  const list = safeRead()
  safeWrite([entry, ...list].slice(0, MAX_ENTRIES))
}

export function getDebugEntries(): AiDebugEntry[] {
  return safeRead()
}

export function clearDebugEntries(): void {
  safeWrite([])
}

/** 删除单条调试记录 */
export function removeDebugEntry(id: string): void {
  safeWrite(safeRead().filter((e) => e.id !== id))
}

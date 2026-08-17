import { useEffect, useState } from 'react'

/** AI 对话模式：'discuss-first' 先讨论再执行 / 'act-along' 边执行边讨论 */
export type ChatMode = 'discuss-first' | 'act-along'

/** 默认对话模式：先讨论再执行 */
const DEFAULT_CHAT_MODE: ChatMode = 'discuss-first'

/** localStorage 存储键 */
const STORAGE_KEY = 'subsilicon_ai_chat_mode'

/** 变更广播事件名 */
const CHANGE_EVENT = 'subsilicon-chat-mode-change'

/** 合法模式集合（用于校验存储值，损坏 / 非法值一律回退默认） */
const VALID_MODES: ReadonlySet<string> = new Set<string>(['discuss-first', 'act-along'])

function isChatMode(value: unknown): value is ChatMode {
  return typeof value === 'string' && VALID_MODES.has(value)
}

/** 获取当前 AI 对话模式（无值 / 损坏 / localStorage 不可用时回退默认，不抛错） */
export function getChatMode(): ChatMode {
  if (typeof window === 'undefined') return DEFAULT_CHAT_MODE
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (isChatMode(value)) return value
  } catch {
    // localStorage 不可用 / 抛错时静默回退默认
  }
  return DEFAULT_CHAT_MODE
}

/** 设置 AI 对话模式并持久化，同时广播变更事件（存储失败不阻断广播，保证界面同步） */
export function setChatMode(mode: ChatMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // localStorage 不可用时静默忽略，仍广播事件保证界面一致
  }
  window.dispatchEvent(new CustomEvent<ChatMode>(CHANGE_EVENT, { detail: mode }))
}

/** 订阅 AI 对话模式变化，返回取消订阅函数 */
export function subscribeChatMode(listener: (mode: ChatMode) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: Event) => {
    listener((e as CustomEvent<ChatMode>).detail)
  }
  window.addEventListener(CHANGE_EVENT, handler)
  return () => window.removeEventListener(CHANGE_EVENT, handler)
}

/** React hook：跟随 AI 对话模式变化自动重渲染 */
export function useChatMode(): ChatMode {
  const [mode, setMode] = useState<ChatMode>(getChatMode)
  useEffect(() => subscribeChatMode((m) => setMode(m)), [])
  return mode
}

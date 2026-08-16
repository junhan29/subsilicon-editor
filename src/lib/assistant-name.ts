import { useEffect, useState } from 'react'

/** 创作助理默认名字 */
export const DEFAULT_ASSISTANT_NAME = '创作助理'

const STORAGE_KEY = 'subsilicon-assistant-name'
const CHANGE_EVENT = 'subsilicon-assistant-name-change'

/** 获取当前创作助理名字（用户可自定义，缺省为默认名） */
export function getAssistantName(): string {
  if (typeof window === 'undefined') return DEFAULT_ASSISTANT_NAME
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)?.trim()
    if (v) return v
  } catch {
  }
  return DEFAULT_ASSISTANT_NAME
}

/** 设置创作助理名字并持久化（空值回退默认名），返回实际生效的名字 */
export function setAssistantName(name: string): string {
  const clean = name.trim() || DEFAULT_ASSISTANT_NAME
  try {
    window.localStorage.setItem(STORAGE_KEY, clean)
  } catch {
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: clean }))
  return clean
}

/** 订阅创作助理名字变化，返回取消订阅函数 */
export function subscribeAssistantName(callback: (name: string) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: Event) => {
    callback((e as CustomEvent<string>).detail)
  }
  window.addEventListener(CHANGE_EVENT, handler)
  return () => window.removeEventListener(CHANGE_EVENT, handler)
}

/** React hook：跟随创作助理名字变化自动重渲染 */
export function useAssistantName(): string {
  const [name, setName] = useState<string>(getAssistantName)
  useEffect(() => subscribeAssistantName((n) => setName(n)), [])
  return name
}

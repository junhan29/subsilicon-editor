// 编辑器主题切换管理
// 切换时给 document.documentElement 添加/移除 'light' class，
// 同时移除/添加 'dark' class（与 host 应用的 globals.css 配合）。

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'subsilicon-editor-theme'

/** 获取当前生效的主题（默认深色） */
export function getCurrentTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.classList.contains('light') ? 'light' : 'dark'
}

/** 设置主题：更新 DOM class 并持久化到 localStorage */
export function setTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme === 'light') {
    root.classList.add('light')
    root.classList.remove('dark')
  } else {
    root.classList.remove('light')
    root.classList.add('dark')
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // 忽略写入失败
  }
  // 通知监听者
  window.dispatchEvent(new CustomEvent('subsilicon-theme-change', { detail: theme }))
}

/** 切换主题 */
export function toggleTheme(): Theme {
  const next: Theme = getCurrentTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}

/** 从 localStorage 读取已保存的主题偏好（不修改 DOM） */
export function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === 'dark' || v === 'light') return v
  } catch {
    // 忽略
  }
  return null
}

/**
 * 初始化主题：在编辑器挂载时调用，根据 localStorage 偏好应用主题。
 * 若无偏好，保持当前 DOM 状态（默认深色）。
 */
export function initTheme(): Theme {
  const stored = getStoredTheme()
  if (stored) {
    setTheme(stored)
    return stored
  }
  return getCurrentTheme()
}

/** 订阅主题变化，返回取消订阅函数 */
export function subscribeTheme(callback: (theme: Theme) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: Event) => {
    callback((e as CustomEvent<Theme>).detail)
  }
  window.addEventListener('subsilicon-theme-change', handler)
  return () => window.removeEventListener('subsilicon-theme-change', handler)
}

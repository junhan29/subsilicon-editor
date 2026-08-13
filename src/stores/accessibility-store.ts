import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useEditorCanvasStore } from './editor-canvas-store'
import { applyDefaultPreset, applySimplePreset } from '../lib/shortcut-manager'

/**
 * ADHD 无障碍适配设置（默认全部关闭，不改变现有行为）。
 * - focusMode：专注模式（临时态，不持久化；进入时收起左右面板 + AI 浮窗，退出时还原）
 * - lowStimulus：低干扰模式（减少动画与视觉刺激）
 * - compactInterface：精简界面（右栏 tab 分组、左侧节点库常用视图）
 * - simpleShortcuts：基础快捷键预设（防误触）
 * - longFeedback：长反馈（toast 停留更久 + 更多无障碍播报）
 */
interface AccessibilityState {
  focusMode: boolean
  lowStimulus: boolean
  compactInterface: boolean
  simpleShortcuts: boolean
  longFeedback: boolean
  /** 进入专注模式前的布局快照（仅内存，退出时还原） */
  _focusSnapshot: { left: string | null; right: string | null; ai: 'hidden' | 'floating' | 'pinned' } | null
  setFocusMode: (v: boolean) => void
  toggleFocusMode: () => void
  setLowStimulus: (v: boolean) => void
  setCompactInterface: (v: boolean) => void
  setSimpleShortcuts: (v: boolean) => void
  setLongFeedback: (v: boolean) => void
}

const STORAGE_KEY = 'subsilicon_accessibility_v1'

export const useAccessibilityStore = create<AccessibilityState>()(
  persist(
    (set, get) => ({
      focusMode: false,
      lowStimulus: false,
      compactInterface: false,
      simpleShortcuts: false,
      longFeedback: false,
      _focusSnapshot: null,

      setFocusMode: (v) => {
        const canvas = useEditorCanvasStore.getState()
        if (v && !get().focusMode) {
          // 进入专注：暂存当前布局并收起全部面板
          set({
            focusMode: true,
            _focusSnapshot: {
              left: canvas.activeLeftActivity,
              right: canvas.activeRightActivity,
              ai: canvas.aiPanelMode,
            },
          })
          canvas.setActiveLeftActivity(null)
          canvas.setActiveRightActivity(null)
          canvas.setAiPanelMode('hidden')
        } else if (!v && get().focusMode) {
          // 退出专注：还原进入前的布局
          const snap = get()._focusSnapshot
          if (snap) {
            canvas.setActiveLeftActivity(snap.left)
            canvas.setActiveRightActivity(snap.right)
            canvas.setAiPanelMode(snap.ai)
          }
          set({ focusMode: false, _focusSnapshot: null })
        }
      },
      toggleFocusMode: () => get().setFocusMode(!get().focusMode),

      setLowStimulus: (v) => set({ lowStimulus: v }),
      setCompactInterface: (v) => set({ compactInterface: v }),
      setSimpleShortcuts: (v) => {
        set({ simpleShortcuts: v })
        // 联动应用/恢复快捷键预设：开关是「基础模式」的唯一入口，
        // 避免只改状态但单字母快捷键仍生效导致防误触落空。
        if (v) applySimplePreset()
        else applyDefaultPreset()
      },
      setLongFeedback: (v) => set({ longFeedback: v }),
    }),
    {
      name: STORAGE_KEY,
      // 专注模式是临时态，不持久化（避免重启后与持久化的布局偏好冲突）
      partialize: (s) => ({
        lowStimulus: s.lowStimulus,
        compactInterface: s.compactInterface,
        simpleShortcuts: s.simpleShortcuts,
        longFeedback: s.longFeedback,
      }),
      // 应用启动重新水合时，按持久化的开关状态恢复快捷键预设
      onRehydrateStorage: () => (state) => {
        if (state?.simpleShortcuts) applySimplePreset()
      },
    }
  )
)

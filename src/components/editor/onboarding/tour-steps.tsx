import { Sparkles, MousePointer2, Settings, Eye, Save } from 'lucide-react'

export interface TourStep {
  id: string
  title: string
  description: string
  target?: string
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  icon?: React.ReactNode
}

export const DEFAULT_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: '欢迎来到故事编辑器',
    description: '这是一个可视化的互动故事创作工具。用节点组织内容，用连线构建分支，让读者的选择影响故事走向。接下来用 30 秒了解核心操作。',
    icon: <Sparkles className="w-6 h-6 text-primary" />,
  },
  {
    id: 'sidebar',
    title: '左侧：节点面板',
    description: '这里有各种故事节点 — 对话、选择、付费解锁、结局。把它们拖到中间的画布上，就能开始搭建你的故事结构了。',
    icon: <MousePointer2 className="w-6 h-6 text-primary" />,
  },
  {
    id: 'canvas',
    title: '中间：创作画布',
    description: '这是你的工作台。拖动节点调整位置，点击节点可在右侧编辑内容。从节点底部的圆点拖到另一个节点顶部，就能创建连线。',
    icon: <Settings className="w-6 h-6 text-primary" />,
  },
  {
    id: 'properties',
    title: '右侧：属性面板',
    description: '选中节点后，这里可以编辑详细内容 — 比如对话的台词、选择的选项、付费金额等。也可以管理故事中的角色。',
    icon: <Settings className="w-6 h-6 text-primary" />,
  },
  {
    id: 'topbar',
    title: '顶部：预览与保存',
    description: '随时点击「预览」查看读者视角的效果，满意后记得「保存」。完成创作后就可以分享给读者啦！',
    icon: <Eye className="w-6 h-6 text-primary" />,
  },
  {
    id: 'complete',
    title: '准备好了吗？',
    description: '试着从左侧拖一个对话节点到画布上，开始你的第一个互动故事吧！遇到问题随时按 ? 查看快捷键，或点击右上角帮助按钮。',
    icon: <Save className="w-6 h-6 text-primary" />,
  },
]

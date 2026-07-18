export interface ShortcutBinding {
  id: string
  action: string
  description: string
  defaultKeys: string[]
  category: 'general' | 'canvas' | 'node' | 'edit' | 'view' | 'help'
  icon?: string
}

export interface ShortcutConfig {
  [actionId: string]: string[]
}

const STORAGE_KEY = 'subsilicon-shortcuts'

const DEFAULT_BINDINGS: ShortcutBinding[] = [
  { id: 'new', action: '新建作品', description: '创建新的空白作品', defaultKeys: ['Ctrl', 'N'], category: 'general', icon: 'Plus' },
  { id: 'open', action: '打开作品', description: '打开本地作品文件', defaultKeys: ['Ctrl', 'O'], category: 'general', icon: 'FolderOpen' },
  { id: 'save', action: '保存作品', description: '保存当前作品到本地', defaultKeys: ['Ctrl', 'S'], category: 'general', icon: 'Save' },
  { id: 'export', action: '导出作品', description: '打开导出对话框', defaultKeys: ['Ctrl', 'E'], category: 'general', icon: 'Download' },
  { id: 'search', action: '查找节点', description: '打开节点查找面板', defaultKeys: ['Ctrl', 'F'], category: 'general', icon: 'Search' },
  { id: 'replace', action: '查找替换', description: '查找并替换节点内容', defaultKeys: ['Ctrl', 'H'], category: 'general', icon: 'Replace' },
  { id: 'shortcuts', action: '快捷键面板', description: '打开快捷键查看面板', defaultKeys: ['?'], category: 'general', icon: 'Keyboard' },

  { id: 'zoomIn', action: '放大画布', description: '放大画布视图', defaultKeys: ['Ctrl', '='], category: 'canvas', icon: 'ZoomIn' },
  { id: 'zoomOut', action: '缩小画布', description: '缩小画布视图', defaultKeys: ['Ctrl', '-'], category: 'canvas', icon: 'ZoomOut' },
  { id: 'fitView', action: '适应视图', description: '自动调整画布以显示所有节点', defaultKeys: ['Shift', '1'], category: 'canvas', icon: 'Maximize' },
  { id: 'zoomToSelection', action: '缩放到选中', description: '将视图缩放到当前选中节点', defaultKeys: ['Shift', '2'], category: 'canvas', icon: 'Focus' },
  { id: 'panCanvas', action: '平移画布', description: '按住空格键拖拽平移画布', defaultKeys: ['Space'], category: 'canvas', icon: 'Move' },
  { id: 'undo', action: '撤销', description: '撤销上一步操作', defaultKeys: ['Ctrl', 'Z'], category: 'canvas', icon: 'Undo' },
  { id: 'redo', action: '重做', description: '重做已撤销的操作', defaultKeys: ['Ctrl', 'Y', 'Ctrl', 'Shift', 'Z'], category: 'canvas', icon: 'Redo' },

  { id: 'addDialogue', action: '添加对话节点', description: '在画布中心添加一个对话节点', defaultKeys: ['D'], category: 'node', icon: 'MessageCircle' },
  { id: 'addChoice', action: '添加选择节点', description: '在画布中心添加一个选择节点', defaultKeys: ['C'], category: 'node', icon: 'GitBranch' },
  { id: 'addEnding', action: '添加结局节点', description: '在画布中心添加一个结局节点', defaultKeys: ['E'], category: 'node', icon: 'Flag' },
  { id: 'addCondition', action: '添加条件节点', description: '在画布中心添加一个条件节点', defaultKeys: ['Shift', 'C'], category: 'node', icon: 'SplitSquareVertical' },
  { id: 'addGather', action: '添加汇聚节点', description: '在画布中心添加一个汇聚节点', defaultKeys: ['G'], category: 'node', icon: 'Merge' },
  { id: 'addJump', action: '添加跳转节点', description: '在画布中心添加一个跳转节点', defaultKeys: ['J'], category: 'node', icon: 'Zap' },
  { id: 'addRandom', action: '添加随机节点', description: '在画布中心添加一个随机节点', defaultKeys: ['R'], category: 'node', icon: 'Shuffle' },
  { id: 'addCG', action: '添加 CG 过场节点', description: '在画布中心添加一个 CG 过场节点', defaultKeys: ['Shift', 'G'], category: 'node', icon: 'Film' },
  { id: 'addUnlock', action: '添加付费解锁节点', description: '在画布中心添加一个付费解锁节点', defaultKeys: ['U'], category: 'node', icon: 'Lock' },
  { id: 'addNarration', action: '添加旁白节点', description: '在画布中心添加一个旁白节点', defaultKeys: ['N'], category: 'node', icon: 'FileText' },
  { id: 'deleteNode', action: '删除节点', description: '删除当前选中的节点', defaultKeys: ['Delete', 'Backspace'], category: 'node', icon: 'Trash' },
  { id: 'selectAll', action: '全选', description: '选中画布上的所有节点', defaultKeys: ['Ctrl', 'A'], category: 'node', icon: 'CheckSquare' },
  { id: 'deselectAll', action: '取消选中', description: '取消当前所有选中', defaultKeys: ['Escape'], category: 'node', icon: 'CircleSlash' },

  { id: 'copy', action: '复制', description: '复制选中的节点到剪贴板', defaultKeys: ['Ctrl', 'C'], category: 'edit', icon: 'Copy' },
  { id: 'paste', action: '粘贴', description: '粘贴剪贴板中的节点', defaultKeys: ['Ctrl', 'V'], category: 'edit', icon: 'Clipboard' },
  { id: 'duplicate', action: '克隆', description: '克隆当前选中的节点', defaultKeys: ['Ctrl', 'D'], category: 'edit', icon: 'Copy' },
  { id: 'group', action: '创建分组', description: '将选中节点创建为分组', defaultKeys: ['Ctrl', 'G'], category: 'edit', icon: 'Layers' },
  { id: 'ungroup', action: '取消分组', description: '取消当前分组（保留节点）', defaultKeys: ['Ctrl', 'Shift', 'G'], category: 'edit', icon: 'Ungroup' },

  { id: 'toggleSidebar', action: '切换左侧栏', description: '显示或隐藏左侧节点面板', defaultKeys: ['B'], category: 'view', icon: 'PanelLeft' },
  { id: 'toggleRightPanel', action: '切换属性面板', description: '显示或隐藏右栏内属性面板', defaultKeys: ['P'], category: 'view', icon: 'PanelRight' },
  { id: 'toggleAiPanel', action: '切换 AI 面板', description: '显示或隐藏中间 AI 创境面板', defaultKeys: ['Ctrl', 'Shift', 'A'], category: 'view', icon: 'MessageSquare' },
  { id: 'toggleRightFullscreen', action: '画布全屏', description: '将右栏画布展开或退出全屏', defaultKeys: [], category: 'view', icon: 'Maximize' },
  { id: 'togglePreview', action: '切换预览', description: '打开或关闭预览模式', defaultKeys: ['Ctrl', 'P'], category: 'view', icon: 'Eye' },
  { id: 'toggleMinimap', action: '切换小地图', description: '显示或隐藏小地图', defaultKeys: ['M'], category: 'view', icon: 'Map' },
  { id: 'qualityCheck', action: '质量检测', description: '打开质量检测面板', defaultKeys: ['Q'], category: 'view', icon: 'ShieldCheck' },
  { id: 'toggleTheme', action: '切换主题', description: '在深色与浅色主题之间切换', defaultKeys: ['Ctrl', 'Shift', 'T'], category: 'view', icon: 'Sun' },

  { id: 'help', action: '帮助中心', description: '打开帮助中心菜单', defaultKeys: ['F1'], category: 'help', icon: 'HelpCircle' },
  { id: 'tour', action: '重新引导', description: '重新播放新手引导', defaultKeys: ['Shift', '?'], category: 'help', icon: 'Play' },
]

export const SHORTCUT_CATEGORY_LABELS: Record<ShortcutBinding['category'], string> = {
  general: '通用',
  canvas: '画布操作',
  node: '节点操作',
  edit: '编辑操作',
  view: '视图操作',
  help: '引导与帮助',
}

export const SHORTCUT_CATEGORY_ORDER: ShortcutBinding['category'][] = [
  'general',
  'canvas',
  'node',
  'edit',
  'view',
  'help',
]

export function getDefaultBindings(): ShortcutBinding[] {
  return DEFAULT_BINDINGS.map((b) => ({ ...b, defaultKeys: [...b.defaultKeys] }))
}

export function loadCustomBindings(): ShortcutConfig {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const result: ShortcutConfig = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
        result[k] = v as string[]
      }
    }
    return result
  } catch {
    return {}
  }
}

export function saveCustomBindings(config: ShortcutConfig): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // 忽略写入失败（隐私模式 / 存储配额超限）
  }
}

export function resetBindings(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 忽略写入失败（隐私模式 / 存储配额超限）
  }
}

export function getActiveKeys(actionId: string): string[] | null {
  const custom = loadCustomBindings()
  if (custom[actionId]) return custom[actionId]
  const binding = DEFAULT_BINDINGS.find((b) => b.id === actionId)
  return binding ? [...binding.defaultKeys] : null
}

/**
 * 将 KeyboardEvent 转换为标准化的按键组合数组。
 * 例如：Ctrl+S → ['Ctrl', 'S']；Shift+1 → ['Shift', '1']；? (Shift+/) → ['?']
 */
export function eventToKeys(event: KeyboardEvent): string[] {
  const keys: string[] = []
  const isMod = event.ctrlKey || event.metaKey
  if (isMod) keys.push('Ctrl')
  if (event.altKey) keys.push('Alt')

  // 修饰键本身不作为主键
  const key = event.key
  if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') {
    if (event.shiftKey) keys.push('Shift')
    return keys
  }

  // 空格特殊处理
  if (key === ' ' || key === 'Spacebar') {
    if (event.shiftKey) keys.push('Shift')
    keys.push('Space')
    return keys
  }

  // 功能键 F1-F12
  if (/^F\d{1,2}$/.test(key)) {
    if (event.shiftKey) keys.push('Shift')
    keys.push(key)
    return keys
  }

  // 字母统一大写
  if (key.length === 1 && /[a-zA-Z]/.test(key)) {
    if (event.shiftKey) keys.push('Shift')
    keys.push(key.toUpperCase())
    return keys
  }

  // 数字
  if (key.length === 1 && /[0-9]/.test(key)) {
    if (event.shiftKey) keys.push('Shift')
    keys.push(key)
    return keys
  }

  // Shift + 数字键：通过 event.code 还原数字（避免布局差异，如 Shift+1 → '!'）
  if (event.shiftKey && event.code && /^Digit\d$/.test(event.code)) {
    keys.push('Shift')
    keys.push(event.code.slice(5)) // 'Digit1' → '1'
    return keys
  }

  // 其他按键使用 key 值（如 Enter, Escape, Delete, Backspace, =, -, ? 等）
  // 对于 Shift 产生的符号（如 '?' 来自 Shift+/），key 已经是符号本身，
  // 此时不再单独添加 'Shift'，以匹配形如 ['?'] 的绑定。
  keys.push(key)
  return keys
}

/**
 * 比较两组按键组合是否等价。
 * 顺序敏感：['Ctrl', 'S'] !== ['S', 'Ctrl']（约定修饰键在前）
 * 但允许「或」语义：binding.defaultKeys 可能是 ['Delete', 'Backspace']，
 * 此时与单键 event 比较，需要拆开比对。
 */
function keysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((k, i) => k === b[i])
}

/**
 * 判断一个按键组合是否匹配某个 action 的当前绑定。
 * 支持两种语义：
 *  - 单组合：含修饰键（Ctrl/Shift/Alt）的视为单一组合，如 ['Ctrl', 'Shift', 'Z'] = Ctrl+Shift+Z
 *  - 多选一：不含修饰键的数组视为多个单键「或」，如 ['Delete', 'Backspace'] = Delete 或 Backspace
 */
export function matchShortcut(event: KeyboardEvent, action: string): boolean {
  const activeKeys = getActiveKeys(action)
  if (!activeKeys || activeKeys.length === 0) return false

  const eventKeys = eventToKeys(event)
  if (eventKeys.length === 0) return false

  const hasModifier = activeKeys.some((k) => k === 'Ctrl' || k === 'Shift' || k === 'Alt')

  // 含修饰键：单一组合
  if (hasModifier) {
    return keysEqual(activeKeys, eventKeys)
  }

  // 不含修饰键：每个键都是独立的「或」候选
  return activeKeys.some((k) => keysEqual([k], eventKeys))
}

export function formatKeys(keys: string[]): string {
  return keys.join('+')
}

export function detectConflicts(actionId: string, keys: string[]): string[] {
  const conflicts: string[] = []
  const all = getAllActiveBindings()

  const keysHasModifier = keys.some((k) => k === 'Ctrl' || k === 'Shift' || k === 'Alt')

  for (const binding of all) {
    if (binding.id === actionId) continue
    const bKeys = binding.keys
    const bHasModifier = bKeys.some((k) => k === 'Ctrl' || k === 'Shift' || k === 'Alt')

    // 完全相同 → 冲突
    if (keysEqual(bKeys, keys)) {
      conflicts.push(binding.id)
      continue
    }

    // 两个都是单键「或」组合：检查是否有交集
    if (!keysHasModifier && !bHasModifier) {
      const keySet = new Set(keys)
      if (bKeys.some((k) => keySet.has(k))) {
        conflicts.push(binding.id)
      }
    }
    // 单键组合 vs 修饰键组合：单键如果与修饰键组合中的非修饰键相同，不算冲突
    // （例如 'D' 单键 vs Ctrl+D，不冲突）
  }

  // 去重
  return Array.from(new Set(conflicts))
}

export interface ActiveBinding extends ShortcutBinding {
  keys: string[]
}

export function getAllActiveBindings(): ActiveBinding[] {
  const custom = loadCustomBindings()
  return getDefaultBindings().map((b) => ({
    ...b,
    keys: custom[b.id] ? [...custom[b.id]] : [...b.defaultKeys],
  }))
}

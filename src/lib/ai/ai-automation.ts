/**
 * 预设条件自动执行（AI Automation）
 *
 * 规则引擎：当满足触发条件（用户消息关键词/正则，或画布状态）时，
 * 自动执行一组预设动作（AiAction[]），让 AI 在接收对话后按预设执行任务。
 *
 * 与对话驱动的区别：
 * - 对话驱动：AI 自由决定是否输出 ai-action（不可控）
 * - 预设规则：由用户显式配置「条件 → 动作」，匹配即执行（可控、可预期）
 */

import type { AiAction } from './chat-command-executor'

/** 触发条件类型 */
export type AutomationTriggerType = 'keyword' | 'regex' | 'state'

/** 画布状态快照（用于 state 类触发） */
export interface AutomationGraphState {
  nodeCount: number
  edgeCount: number
  characterCount: number
  sceneCount: number
}

/** 状态触发条件（nodeCount 等） */
export interface StateTriggerCondition {
  /** 节点数小于等于该值时触发 */
  nodeCountBelowOrEqual?: number
  /** 节点数等于该值时触发 */
  nodeCountEquals?: number
  /** 角色数等于该值时触发 */
  characterCountEquals?: number
}

export interface AutomationRule {
  id: string
  name: string
  /** 规则说明（展示用） */
  description?: string
  enabled: boolean
  triggerType: AutomationTriggerType
  /** keyword: 包含任意关键词即触发（用逗号分隔多个）; regex: 正则表达式 */
  pattern?: string
  /** state 触发条件 */
  stateCondition?: StateTriggerCondition
  /** 匹配后要执行的动作序列 */
  actions: AiAction[]
  /** 内置规则不可删除 */
  builtin?: boolean
}

export interface AutomationMatchResult {
  rule: AutomationRule
  /** 命中说明（如「命中关键词：开场」） */
  matchedBy: string
}

const STORAGE_KEY = 'subsilicon.ai.automation.rules.v1'

/** 内置规则：关键词触发 */
function getBuiltinRules(): AutomationRule[] {
  return [
    {
      id: 'builtin-opening',
      name: '开场模板',
      description: '当用户提到「开场」「开头」时，自动创建旁白 + 对话开场节点',
      enabled: true,
      builtin: true,
      triggerType: 'keyword',
      pattern: '开场,开头,opening,开始一段',
      actions: [
        {
          type: 'createNode',
          payload: {
            nodeType: 'narration',
            data: { text: '（故事从这里开始）' },
          },
        },
        {
          type: 'createNode',
          payload: {
            nodeType: 'dialogue',
            data: { text: '……' },
          },
        },
      ],
    },
    {
      id: 'builtin-save-reminder',
      name: '保存提醒',
      description: '当用户提到「保存」「存档」时，自动保存作品',
      enabled: true,
      builtin: true,
      triggerType: 'keyword',
      pattern: '保存,存档,存一下,save',
      actions: [{ type: 'saveWork', payload: {} }],
    },
    {
      id: 'builtin-undo',
      name: '撤销指令',
      description: '当用户提到「撤销」「回退」「不要这个」时，自动撤销',
      enabled: true,
      builtin: true,
      triggerType: 'keyword',
      pattern: '撤销,回退,不要这个,undo,back',
      actions: [{ type: 'undo', payload: {} }],
    },
    {
      id: 'builtin-empty-canvas',
      name: '空画布引导',
      description: '画布为空时，自动创建一个旁白节点引导创作',
      enabled: true,
      builtin: true,
      triggerType: 'state',
      stateCondition: { nodeCountEquals: 0 },
      actions: [
        {
          type: 'createNode',
          payload: {
            nodeType: 'narration',
            data: { text: '从一个场景开始吧——在旁白节点写下你的第一句话。' },
          },
        },
      ],
    },
  ]
}

function safeReadRules(): AutomationRule[] {
  if (typeof localStorage === 'undefined') return getBuiltinRules()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return getBuiltinRules()
    const parsed = JSON.parse(raw) as AutomationRule[]
    // 合并内置规则（确保升级后新增的内置规则仍出现）
    const builtinIds = new Set(parsed.filter((r) => r.builtin).map((r) => r.id))
    return [...parsed, ...getBuiltinRules().filter((r) => !builtinIds.has(r.id))]
  } catch {
    return getBuiltinRules()
  }
}

function safeWriteRules(list: AutomationRule[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // 忽略（隐私模式 / 配额超限）
  }
}

export function listAutomationRules(): AutomationRule[] {
  return safeReadRules()
}

export function getEnabledAutomationRules(): AutomationRule[] {
  return safeReadRules().filter((r) => r.enabled)
}

export function addAutomationRule(rule: Omit<AutomationRule, 'id' | 'builtin'>): AutomationRule {
  const list = safeReadRules()
  const next: AutomationRule = { ...rule, id: `rule_${Date.now()}`, builtin: false }
  safeWriteRules([...list, next])
  return next
}

export function updateAutomationRule(id: string, patch: Partial<Omit<AutomationRule, 'id'>>): void {
  const list = safeReadRules()
  const idx = list.findIndex((r) => r.id === id)
  if (idx === -1) return
  const merged = { ...list[idx], ...patch }
  // 内置规则不允许修改 triggerType / pattern / actions（避免覆盖）
  if (merged.builtin) {
    merged.triggerType = list[idx].triggerType
    merged.pattern = list[idx].pattern
    merged.actions = list[idx].actions
    merged.stateCondition = list[idx].stateCondition
  }
  list[idx] = merged
  safeWriteRules(list)
}

export function removeAutomationRule(id: string): void {
  // 仅允许删除自定义规则；内置规则即使 id 匹配也保留
  const list = safeReadRules().filter((r) => r.builtin || r.id !== id)
  safeWriteRules(list)
}

/** 重置为仅内置规则 */
export function resetAutomationRules(): void {
  safeWriteRules(getBuiltinRules())
}

/** 关键词匹配：用户输入包含 pattern 中任意一个关键词 */
function matchKeyword(input: string, pattern?: string): boolean {
  if (!pattern) return false
  const lower = input.toLowerCase()
  return pattern
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .some((k) => lower.includes(k))
}

/** 正则匹配 */
function matchRegex(input: string, pattern?: string): boolean {
  if (!pattern) return false
  try {
    return new RegExp(pattern, 'i').test(input)
  } catch {
    return false
  }
}

/** 状态匹配 */
function matchState(state: AutomationGraphState, condition?: StateTriggerCondition): boolean {
  if (!condition) return false
  if (
    condition.nodeCountBelowOrEqual !== undefined &&
    state.nodeCount > condition.nodeCountBelowOrEqual
  ) {
    return false
  }
  if (
    condition.nodeCountEquals !== undefined &&
    state.nodeCount !== condition.nodeCountEquals
  ) {
    return false
  }
  if (
    condition.characterCountEquals !== undefined &&
    state.characterCount !== condition.characterCountEquals
  ) {
    return false
  }
  return true
}

/**
 * 匹配所有命中的启用规则。
 * @param input 用户最新消息
 * @param state 当前画布状态
 * @param matchedRuleIds 已触发过的规则 ID（同一规则在一轮对话中不重复触发）
 */
export function matchAutomationRules(
  input: string,
  state: AutomationGraphState,
  matchedRuleIds?: string[]
): AutomationMatchResult[] {
  const results: AutomationMatchResult[] = []
  for (const rule of getEnabledAutomationRules()) {
    if (matchedRuleIds?.includes(rule.id)) continue
    switch (rule.triggerType) {
      case 'keyword':
        if (matchKeyword(input, rule.pattern)) {
          results.push({ rule, matchedBy: `命中关键词` })
        }
        break
      case 'regex':
        if (matchRegex(input, rule.pattern)) {
          results.push({ rule, matchedBy: `命中正则` })
        }
        break
      case 'state':
        if (matchState(state, rule.stateCondition)) {
          results.push({ rule, matchedBy: `画布状态` })
        }
        break
    }
  }
  return results
}

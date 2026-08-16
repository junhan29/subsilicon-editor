// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  type AutomationGraphState,
  addAutomationRule,
  getEnabledAutomationRules,
  listAutomationRules,
  matchAutomationRules,
  removeAutomationRule,
  resetAutomationRules,
  updateAutomationRule,
} from '../ai/ai-automation'

const STORAGE_KEY = 'subsilicon.ai.automation.rules.v1'

function emptyState(): AutomationGraphState {
  return { nodeCount: 0, edgeCount: 0, characterCount: 0, sceneCount: 0 }
}

beforeEach(() => {
  localStorage.clear()
})

describe('内置规则', () => {
  it('首次加载返回全部内置规则', () => {
    const rules = listAutomationRules()
    const names = rules.map((r) => r.name)
    expect(names).toContain('开场模板')
    expect(names).toContain('保存提醒')
    expect(names).toContain('撤销指令')
    expect(names).toContain('空画布引导')
    expect(rules.every((r) => r.builtin)).toBe(true)
  })

  it('升级后新增的内置规则会自动合并', () => {
    // 模拟旧版本只存了部分内置规则
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { id: 'builtin-opening', name: '开场模板', enabled: true, builtin: true, triggerType: 'keyword', pattern: '开场', actions: [] },
    ]))
    const rules = listAutomationRules()
    expect(rules.some((r) => r.id === 'builtin-opening')).toBe(true)
    expect(rules.some((r) => r.id === 'builtin-save-reminder')).toBe(true)
  })

  it('内置规则不可删除', () => {
    const before = listAutomationRules().length
    removeAutomationRule('builtin-opening')
    expect(listAutomationRules().length).toBe(before)
  })

  it('重置恢复为仅内置规则', () => {
    addAutomationRule({ name: '自定义', enabled: true, triggerType: 'keyword', pattern: '测试', actions: [] })
    expect(listAutomationRules().length).toBeGreaterThan(4)
    resetAutomationRules()
    expect(listAutomationRules().length).toBe(4)
    expect(listAutomationRules().every((r) => r.builtin)).toBe(true)
  })
})

describe('关键词触发', () => {
  it('命中关键词时返回规则', () => {
    const hits = matchAutomationRules('帮我写一个开场吧', emptyState())
    expect(hits.some((h) => h.rule.id === 'builtin-opening')).toBe(true)
    expect(hits.find((h) => h.rule.id === 'builtin-opening')?.matchedBy).toContain('关键词')
  })

  it('未命中关键词不返回', () => {
    const hits = matchAutomationRules('帮我画一张图', emptyState())
    expect(hits.some((h) => h.rule.id === 'builtin-opening')).toBe(false)
  })

  it('自定义关键词规则', () => {
    addAutomationRule({ name: '测试规则', enabled: true, triggerType: 'keyword', pattern: '开灯,关灯', actions: [] })
    const hits = matchAutomationRules('麻烦关灯一下', emptyState())
    expect(hits.some((h) => h.rule.name === '测试规则')).toBe(true)
  })
})

describe('正则触发', () => {
  it('命中正则返回规则', () => {
    addAutomationRule({ name: '以开始开头', enabled: true, triggerType: 'regex', pattern: '^开始', actions: [] })
    const hits = matchAutomationRules('开始写第一章', emptyState())
    expect(hits.some((h) => h.rule.name === '以开始开头')).toBe(true)
  })

  it('非法正则不抛错且不命中', () => {
    addAutomationRule({ name: '坏正则', enabled: true, triggerType: 'regex', pattern: '(', actions: [] })
    expect(() => matchAutomationRules('随便说说', emptyState())).not.toThrow()
  })
})

describe('状态触发', () => {
  it('空画布时命中空画布引导', () => {
    const hits = matchAutomationRules('帮我开始创作', emptyState())
    expect(hits.some((h) => h.rule.id === 'builtin-empty-canvas')).toBe(true)
  })

  it('画布已有节点时不命中', () => {
    const hits = matchAutomationRules('帮我开始创作', { nodeCount: 3, edgeCount: 2, characterCount: 1, sceneCount: 0 })
    expect(hits.some((h) => h.rule.id === 'builtin-empty-canvas')).toBe(false)
  })

  it('自定义状态规则（节点数等于 N）', () => {
    addAutomationRule({ name: '节点数等于2', enabled: true, triggerType: 'state', stateCondition: { nodeCountEquals: 2 }, actions: [] })
    expect(matchAutomationRules('x', { nodeCount: 2, edgeCount: 0, characterCount: 0, sceneCount: 0 }).some((h) => h.rule.name === '节点数等于2')).toBe(true)
    expect(matchAutomationRules('x', { nodeCount: 3, edgeCount: 0, characterCount: 0, sceneCount: 0 }).some((h) => h.rule.name === '节点数等于2')).toBe(false)
  })
})

describe('规则管理', () => {
  it('新增规则后出现在列表中且启用', () => {
    addAutomationRule({ name: '新规则', enabled: true, triggerType: 'keyword', pattern: '新词', actions: [] })
    const rules = listAutomationRules()
    expect(rules.some((r) => r.name === '新规则' && r.enabled)).toBe(true)
  })

  it('停用的规则不参与匹配', () => {
    const added = addAutomationRule({ name: '停用规则', enabled: true, triggerType: 'keyword', pattern: '停用词', actions: [] })
    updateAutomationRule(added.id, { enabled: false })
    const hits = matchAutomationRules('停用词', emptyState())
    expect(hits.some((h) => h.rule.name === '停用规则')).toBe(false)
    expect(getEnabledAutomationRules().some((r) => r.name === '停用规则')).toBe(false)
  })

  it('自定义规则可删除，内置不可删', () => {
    const added = addAutomationRule({ name: '临时规则', enabled: true, triggerType: 'keyword', pattern: 'x', actions: [] })
    removeAutomationRule(added.id)
    expect(listAutomationRules().some((r) => r.id === added.id)).toBe(false)
  })

  it('内置规则禁止修改触发条件与动作', () => {
    updateAutomationRule('builtin-opening', { pattern: '篡改', actions: [{ type: 'saveWork' as any, payload: {} }] })
    const rule = listAutomationRules().find((r) => r.id === 'builtin-opening')!
    expect(rule.pattern).toContain('开场')
    expect(rule.actions.every((a) => a.type !== 'saveWork')).toBe(true)
  })

  it('matchedRuleIds 阻止同一规则重复触发', () => {
    const hits1 = matchAutomationRules('保存一下', emptyState())
    expect(hits1.some((h) => h.rule.id === 'builtin-save-reminder')).toBe(true)
    const ids = hits1.map((h) => h.rule.id)
    const hits2 = matchAutomationRules('再保存一次', emptyState(), ids)
    expect(hits2.some((h) => h.rule.id === 'builtin-save-reminder')).toBe(false)
  })
})

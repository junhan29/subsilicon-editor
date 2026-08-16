import { describe, it, expect } from 'vitest'
import { dispatchParsedCommands, type AiAction } from '../ai/chat-command-executor'

function action(type: AiAction['type']): AiAction {
  return { type, payload: {} }
}

describe('dispatchParsedCommands（预览审批决策）', () => {
  it('空动作永不进入预览', () => {
    expect(dispatchParsedCommands([], true)).toEqual({ mode: 'execute', actions: [] })
    expect(dispatchParsedCommands([], false)).toEqual({ mode: 'execute', actions: [] })
  })

  it('非空动作 + 预览关闭 → 直接执行', () => {
    const r = dispatchParsedCommands([action('createNode')], false)
    expect(r.mode).toBe('execute')
    expect(r.actions).toHaveLength(1)
  })

  it('非空动作 + 预览开启 → 暂存待批准（不执行）', () => {
    const r = dispatchParsedCommands([action('createNode')], true)
    expect(r.mode).toBe('preview')
    expect(r.actions).toHaveLength(1)
  })

  it('动作原样保留，不丢字段', () => {
    const a = action('updateNode')
    a.payload = { nodeId: 'x', data: { text: '你好' } }
    const r = dispatchParsedCommands([a], true)
    expect(r.actions[0].payload).toEqual({ nodeId: 'x', data: { text: '你好' } })
  })

  it('多动作原样透传', () => {
    const acts = [action('addCharacter'), action('connectNodes'), action('saveWork')]
    expect(dispatchParsedCommands(acts, true).actions).toHaveLength(3)
    expect(dispatchParsedCommands(acts, false).actions).toEqual(acts)
  })
})

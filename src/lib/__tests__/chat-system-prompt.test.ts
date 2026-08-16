import { describe, it, expect } from 'vitest'
import { getChatSystemPrompt } from '../ai/chat-system-prompt'

const OPERATIONS = [
  'createNode', 'updateNode', 'deleteNode', 'connectNodes', 'updateEdge', 'deleteEdge',
  'selectNode', 'addCharacter', 'bindAsset', 'requestMediaGeneration',
  'saveWork', 'exportWork', 'previewWork', 'undo', 'redo',
]

describe('chat-system-prompt', () => {
  it('包含亚硅命令格式（ai-action 代码块）', () => {
    const p = getChatSystemPrompt('')
    expect(p).toContain('ai-action')
    expect(p).toContain('## 亚硅命令格式')
  })

  it('操作规则覆盖全部 15 种操作', () => {
    const p = getChatSystemPrompt('')
    for (const op of OPERATIONS) {
      expect(p).toContain(`**${op}**:`)
    }
  })

  it('包含全能创作工作流与每轮节点数量约束', () => {
    const p = getChatSystemPrompt('')
    expect(p).toContain('全能创作工作流')
    expect(p).toContain('每轮 3-6')
  })

  it('包含先聊后做策略（先聊灵感、分析提炼、确认后再落画布）', () => {
    const p = getChatSystemPrompt('')
    expect(p).toContain('先聊后做')
    expect(p).toContain('征询确认')
    expect(p).toContain('不要一上来就创建节点')
  })

  it('媒体生成必须先说明意图并等待用户授权', () => {
    const p = getChatSystemPrompt('')
    expect(p).toContain('等待用户授权')
    expect(p).toContain('requestMediaGeneration')
  })

  it('空画布上下文给出引导语', () => {
    const p = getChatSystemPrompt('')
    expect(p).toContain('项目为空，请引导用户开始创作')
  })

  it('注入的画布上下文出现在提示词中', () => {
    const ctx = '节点 3 个 / 角色 小明 / 场景 教室'
    const p = getChatSystemPrompt(ctx)
    expect(p).toContain(ctx)
  })
})

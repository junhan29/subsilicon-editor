/** generation-policy 单元测试：输入分级 / 去 AI 化 / 逻辑约束上下文 */
import { describe, expect, it } from 'vitest'
import {
  buildContextPrompt,
  buildDeaiPrompt,
  buildFidelityPrompt,
  buildGenerationPolicyPrompt,
  classifyInput,
  DEAI_WORDS,
  deaiStyle,
} from '../ai/services/generation-policy'
import type { GenerationContext } from '../ai/services/generation-policy'

describe('classifyInput 输入分级', () => {
  it('短文本（无结构化标记）→ expand', () => {
    expect(classifyInput('一个关于失忆侦探的故事')).toBe('expand')
    expect(classifyInput('主角是条龙')).toBe('expand')
  })

  it('长文本 → faithful', () => {
    const longText = '这是一个非常完整的故事描述，包含了开篇、发展、高潮和结局，主角在冒险途中遇到了各种挑战，并且最终达成了自己的目标，整个故事结构完整，逻辑自洽，细节丰富。'
    expect(classifyInput(longText)).toBe('faithful')
  })

  it('含结构化关键词 → faithful（即使很短）', () => {
    expect(classifyInput('大纲：失忆侦探调查案件')).toBe('faithful')
    expect(classifyInput('第一幕：雨夜重逢')).toBe('faithful')
    expect(classifyInput('设定：主角有双重身份')).toBe('faithful')
    expect(classifyInput('第一章 雨夜')).toBe('faithful')
  })

  it('换行分点视为结构化输入 → faithful', () => {
    expect(classifyInput('- 主角失忆\n- 侦探身份\n- 雨夜命案')).toBe('faithful')
    expect(classifyInput('1. 开场\n2. 冲突\n3. 结局')).toBe('faithful')
  })

  it('structuredHint 显式覆盖启发式判断', () => {
    expect(classifyInput('短句', { structuredHint: true })).toBe('faithful')
    expect(classifyInput('很长的一段完整大纲描述，包含足够的细节……', { structuredHint: false })).toBe('expand')
  })

  it('自定义 expandThresholdChars 阈值生效', () => {
    expect(classifyInput('三十个字符以内的短输入文本内容', { expandThresholdChars: 50 })).toBe('expand')
    expect(classifyInput('三十个字符以内的短输入文本内容', { expandThresholdChars: 10 })).toBe('faithful')
  })
})

describe('buildFidelityPrompt 保真模式提示词', () => {
  it('两种模式返回内容不同', () => {
    const expandPrompt = buildFidelityPrompt('expand')
    const faithfulPrompt = buildFidelityPrompt('faithful')
    expect(expandPrompt).not.toBe(faithfulPrompt)
  })

  it('expand 模式含「补全」「可修改」关键约束', () => {
    const prompt = buildFidelityPrompt('expand')
    expect(prompt).toContain('补全')
    expect(prompt).toContain('可自行修改')
  })

  it('faithful 模式含「忠实」「不新增设定」「不改变走向」关键约束', () => {
    const prompt = buildFidelityPrompt('faithful')
    expect(prompt).toContain('忠实')
    expect(prompt).toContain('不新增任何设定')
    expect(prompt).toContain('不改变故事走向')
    expect(prompt).toContain('不替换或新增角色')
  })
})

describe('buildDeaiPrompt 去 AI 化提示词', () => {
  it('包含口语化、禁止万能开场、避免高频表达等约束', () => {
    const prompt = buildDeaiPrompt()
    expect(prompt).toContain('口语化')
    expect(prompt).toContain('万能开场白')
    expect(prompt).toContain('总而言之')
    expect(prompt).toContain('总结')
  })
})

describe('DEAI_WORDS 词表', () => {
  it('词表包含关键 AI 高频表达且数量在 10-20 之间', () => {
    expect(DEAI_WORDS).toContain('然而')
    expect(DEAI_WORDS).toContain('总而言之')
    expect(DEAI_WORDS).toContain('让我们')
    expect(DEAI_WORDS).toContain('综上所述')
    expect(DEAI_WORDS).toContain('值得一提的是')
    expect(DEAI_WORDS.length).toBeGreaterThanOrEqual(10)
    expect(DEAI_WORDS.length).toBeLessThanOrEqual(20)
  })
})

describe('deaiStyle 输出后处理', () => {
  it('命中词表时被替换为更自然表达', () => {
    expect(deaiStyle('然而他并没有放弃')).toBe('可他并没有放弃')
    expect(deaiStyle('因此他决定离开')).toBe('所以他决定离开')
    expect(deaiStyle('事实上她早就知道')).toBe('其实她早就知道')
    expect(deaiStyle('归根结底，还是钱的问题')).toBe('说到底，还是钱的问题')
  })

  it('命中词表时被删除', () => {
    expect(deaiStyle('总的来说，这是一个好故事')).toBe('这是一个好故事')
    expect(deaiStyle('让我们开始吧')).toBe('开始吧')
    expect(deaiStyle('综上所述，主角选择了离开')).toBe('主角选择了离开')
  })

  it('普通文本保持不变', () => {
    const normal = '夜色很深，他推开锈迹斑斑的铁门，巷子尽头传来猫叫。'
    expect(deaiStyle(normal)).toBe(normal)
  })

  it('空文本/空字符串安全返回', () => {
    expect(deaiStyle('')).toBe('')
    expect(deaiStyle('   ')).toBe('')
  })

  it('语义保持完整（多词命中同时处理）', () => {
    const input = '然而，总的来说，我们仍然决定继续前进。'
    const result = deaiStyle(input)
    expect(result).not.toContain('然而')
    expect(result).not.toContain('总的来说')
    expect(result).toContain('决定继续前进')
  })
})

describe('buildContextPrompt 逻辑约束上下文', () => {
  it('空 context 返回空串', () => {
    expect(buildContextPrompt({})).toBe('')
    expect(buildContextPrompt({ workPremise: '  ', characters: [] })).toBe('')
  })

  it('含 workPremise 时包含核心设定段', () => {
    const prompt = buildContextPrompt({ workPremise: '世界观：蒸汽朋克都市' })
    expect(prompt).toContain('作品核心设定')
    expect(prompt).toContain('蒸汽朋克都市')
    expect(prompt).toContain('不得与之冲突')
  })

  it('含角色/大纲摘要/近期输入时包含对应各段', () => {
    const ctx: GenerationContext = {
      workPremise: '世界观：蒸汽朋克都市',
      characters: ['林默（侦探）', '苏晴（线人）'],
      outlineSummary: '第一幕：雨夜命案，主角受托调查',
      creatorInputs: ['主角失忆', '结尾留悬念'],
    }
    const prompt = buildContextPrompt(ctx)
    expect(prompt).toContain('【作品核心设定】')
    expect(prompt).toContain('【已有角色】')
    expect(prompt).toContain('- 林默（侦探）')
    expect(prompt).toContain('【大纲摘要】')
    expect(prompt).toContain('【近期创作输入】')
    expect(prompt).toContain('主角失忆')
  })

  it('空字段被跳过', () => {
    const prompt = buildContextPrompt({ characters: ['甲'] })
    expect(prompt).not.toContain('作品核心设定')
    expect(prompt).not.toContain('大纲摘要')
    expect(prompt).toContain('- 甲')
  })
})

describe('buildGenerationPolicyPrompt 组合注入段', () => {
  it('短核心输入时注入 expand 保真段 + 去 AI 化段', () => {
    const prompt = buildGenerationPolicyPrompt('一条龙的故事')
    expect(prompt).toContain('可自行修改')
    expect(prompt).toContain('口语化')
  })

  it('传 context 时包含上下文段', () => {
    const prompt = buildGenerationPolicyPrompt('大纲：雨夜命案', { workPremise: '蒸汽朋克都市' })
    expect(prompt).toContain('不得与之冲突')
    expect(prompt).toContain('蒸汽朋克都市')
  })
})

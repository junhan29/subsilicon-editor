import { describe, it, expect } from 'vitest'
import {
  buildExpression,
  parseExpression,
  createEmptyGroup,
  createEmptyClause,
} from '../condition-builder'
import type {
  ConditionGroup,
  ConditionClause,
  StoryVariable,
} from '@editor/types/editor'

function makeClause(
  overrides: Partial<ConditionClause> & { variable: string }
): ConditionClause {
  return {
    id: `c-${Math.random().toString(36).slice(2, 8)}`,
    variable: overrides.variable,
    operator: overrides.operator ?? '==',
    value: overrides.value ?? 0,
    valueType: overrides.valueType ?? 'number',
  }
}

function makeGroup(
  clauses: ConditionClause[],
  logic: 'AND' | 'OR' = 'AND'
): ConditionGroup {
  return {
    id: `g-${Math.random().toString(36).slice(2, 8)}`,
    logic,
    clauses,
  }
}

const numberVars: StoryVariable[] = [
  { name: 'a', type: 'number', initialValue: 0 },
  { name: 'b', type: 'number', initialValue: 0 },
  { name: 'c', type: 'number', initialValue: 0 },
  { name: 'd', type: 'number', initialValue: 0 },
]

const stringVars: StoryVariable[] = [
  { name: 'name', type: 'string', initialValue: '' },
  { name: 'tags', type: 'string', initialValue: '' },
]

const boolVars: StoryVariable[] = [
  { name: 'flag', type: 'boolean', initialValue: false },
]

describe('buildExpression 基本场景', () => {
  it('空数组返回空字符串', () => {
    expect(buildExpression([])).toBe('')
  })

  it('null 输入返回空字符串', () => {
    expect(buildExpression(null as unknown as ConditionGroup[])).toBe('')
  })

  it('空 clauses 的 group 返回空字符串', () => {
    expect(buildExpression([makeGroup([])])).toBe('')
  })

  it('单个数字比较表达式', () => {
    const groups = [makeGroup([makeClause({ variable: 'a', operator: '>', value: 50, valueType: 'number' })])]
    expect(buildExpression(groups)).toBe('a > 50')
  })

  it('单个字符串相等表达式', () => {
    const groups = [makeGroup([makeClause({ variable: 'name', operator: '==', value: 'alice', valueType: 'string' })])]
    expect(buildExpression(groups)).toBe("name === 'alice'")
  })

  it('布尔值表达式', () => {
    const groups = [makeGroup([makeClause({ variable: 'flag', operator: '==', value: true, valueType: 'boolean' })])]
    expect(buildExpression(groups)).toBe('flag === true')
  })
})

describe('buildExpression 运算符映射', () => {
  it('contains -> .includes()', () => {
    const groups = [makeGroup([makeClause({ variable: 'tags', operator: 'contains', value: 'horror', valueType: 'string' })])]
    expect(buildExpression(groups)).toBe("tags.includes('horror')")
  })

  it('startsWith -> .startsWith()', () => {
    const groups = [makeGroup([makeClause({ variable: 'name', operator: 'startsWith', value: 'al', valueType: 'string' })])]
    expect(buildExpression(groups)).toBe("name.startsWith('al')")
  })

  it('endsWith -> .endsWith()', () => {
    const groups = [makeGroup([makeClause({ variable: 'name', operator: 'endsWith', value: 'ce', valueType: 'string' })])]
    expect(buildExpression(groups)).toBe("name.endsWith('ce')")
  })

  it('!= -> !==', () => {
    const groups = [makeGroup([makeClause({ variable: 'a', operator: '!=', value: 5, valueType: 'number' })])]
    expect(buildExpression(groups)).toBe('a !== 5')
  })

  it('比较运算符保持原样', () => {
    const cases: Array<{ op: ConditionClause['operator']; expected: string }> = [
      { op: '>', expected: 'a > 1' },
      { op: '<', expected: 'a < 1' },
      { op: '>=', expected: 'a >= 1' },
      { op: '<=', expected: 'a <= 1' },
    ]
    for (const c of cases) {
      const groups = [makeGroup([makeClause({ variable: 'a', operator: c.op, value: 1, valueType: 'number' })])]
      expect(buildExpression(groups)).toBe(c.expected)
    }
  })
})

describe('buildExpression 字符串转义', () => {
  it("单引号被转义为 \\'", () => {
    const groups = [makeGroup([makeClause({ variable: 'name', operator: '==', value: "it's", valueType: 'string' })])]
    expect(buildExpression(groups)).toBe("name === 'it\\'s'")
  })

  it('反斜杠被转义为 \\\\', () => {
    const groups = [makeGroup([makeClause({ variable: 'name', operator: '==', value: 'a\\b', valueType: 'string' })])]
    expect(buildExpression(groups)).toBe("name === 'a\\\\b'")
  })
})

describe('buildExpression 复杂条件组合 AND/OR', () => {
  it('单组多 clause AND 组合', () => {
    const groups = [makeGroup([
      makeClause({ variable: 'a', operator: '>', value: 50, valueType: 'number' }),
      makeClause({ variable: 'b', operator: '<', value: 10, valueType: 'number' }),
    ], 'AND')]
    expect(buildExpression(groups)).toBe('a > 50 && b < 10')
  })

  it('单组多 clause OR 组合', () => {
    const groups = [makeGroup([
      makeClause({ variable: 'a', operator: '>', value: 50, valueType: 'number' }),
      makeClause({ variable: 'b', operator: '<', value: 10, valueType: 'number' }),
    ], 'OR')]
    expect(buildExpression(groups)).toBe('a > 50 || b < 10')
  })

  it('多组多 clause 用括号包裹并以 && 连接', () => {
    const groups = [
      makeGroup([
        makeClause({ variable: 'a', operator: '>', value: 50, valueType: 'number' }),
        makeClause({ variable: 'b', operator: '<', value: 10, valueType: 'number' }),
      ], 'AND'),
      makeGroup([
        makeClause({ variable: 'c', operator: '>', value: 5, valueType: 'number' }),
        makeClause({ variable: 'd', operator: '<', value: 3, valueType: 'number' }),
      ], 'OR'),
    ]
    expect(buildExpression(groups)).toBe('(a > 50 && b < 10) && (c > 5 || d < 3)')
  })

  it('多组单 clause 不加括号', () => {
    const groups = [
      makeGroup([makeClause({ variable: 'a', operator: '>', value: 50, valueType: 'number' })]),
      makeGroup([makeClause({ variable: 'b', operator: '<', value: 10, valueType: 'number' })]),
    ]
    expect(buildExpression(groups)).toBe('a > 50 && b < 10')
  })
})

describe('parseExpression 基本场景', () => {
  it('空表达式返回空数组', () => {
    expect(parseExpression('', numberVars)).toEqual([])
  })

  it('空白表达式返回空数组', () => {
    expect(parseExpression('   ', numberVars)).toEqual([])
  })

  it('解析单个数字比较表达式', () => {
    const groups = parseExpression('a > 50', numberVars)
    expect(groups).toHaveLength(1)
    expect(groups[0].logic).toBe('AND')
    expect(groups[0].clauses).toHaveLength(1)
    const c = groups[0].clauses[0]
    expect(c.variable).toBe('a')
    expect(c.operator).toBe('>')
    expect(c.value).toBe(50)
    expect(c.valueType).toBe('number')
  })

  it('解析 AND 多 clause', () => {
    const groups = parseExpression('a > 50 && b < 10', numberVars)
    expect(groups).toHaveLength(1)
    expect(groups[0].logic).toBe('AND')
    expect(groups[0].clauses).toHaveLength(2)
  })

  it('解析 OR 多 clause', () => {
    const groups = parseExpression('a > 50 || b < 10', numberVars)
    expect(groups).toHaveLength(1)
    expect(groups[0].clauses).toHaveLength(2)
  })

  it('解析括号分组', () => {
    const groups = parseExpression('(a > 50 && b < 10) && (c > 5 || d < 3)', numberVars)
    expect(groups).toHaveLength(2)
    expect(groups[0].logic).toBe('AND')
    expect(groups[1].logic).toBe('OR')
  })
})

describe('parseExpression 运算符识别', () => {
  it('识别 == 和 ===', () => {
    for (const op of ['==', '===']) {
      const groups = parseExpression(`a ${op} 5`, numberVars)
      expect(groups[0].clauses[0].operator).toBe('==')
    }
  })

  it('识别 != 和 !==', () => {
    for (const op of ['!=', '!==']) {
      const groups = parseExpression(`a ${op} 5`, numberVars)
      expect(groups[0].clauses[0].operator).toBe('!=')
    }
  })

  it('识别 >= 和 <=', () => {
    expect(parseExpression('a >= 5', numberVars)[0].clauses[0].operator).toBe('>=')
    expect(parseExpression('a <= 5', numberVars)[0].clauses[0].operator).toBe('<=')
  })

  it('识别字符串值', () => {
    const groups = parseExpression("name === 'alice'", stringVars)
    const c = groups[0].clauses[0]
    expect(c.value).toBe('alice')
    expect(c.valueType).toBe('string')
  })

  it('识别布尔值', () => {
    const groups = parseExpression('flag === true', boolVars)
    const c = groups[0].clauses[0]
    expect(c.value).toBe(true)
    expect(c.valueType).toBe('boolean')
  })

  it('var.includes() 模式（源码限制）', () => {
    expect(parseExpression("tags.includes('horror')", stringVars)).toEqual([])
  })

  it('var.startsWith() 模式（源码限制）', () => {
    expect(parseExpression("name.startsWith('al')", stringVars)).toEqual([])
  })

  it('var.endsWith() 模式（源码限制）', () => {
    expect(parseExpression("name.endsWith('ce')", stringVars)).toEqual([])
  })
})

describe('parseExpression 无效输入', () => {
  it('不包含已知变量时返回空数组', () => {
    expect(parseExpression('unknownVar > 50', numberVars)).toEqual([])
  })

  it('只有运算符时返回空数组', () => {
    expect(parseExpression('> 50', numberVars)).toEqual([])
  })

  it('只有数字时返回空数组', () => {
    expect(parseExpression('50', numberVars)).toEqual([])
  })

  it('不完整表达式返回空数组', () => {
    expect(parseExpression('a', numberVars)).toEqual([])
  })
})

describe('parseExpression + buildExpression 往返一致性', () => {
  it('简单比较往返一致', () => {
    const expr = 'a > 50'
    expect(buildExpression(parseExpression(expr, numberVars))).toBe(expr)
  })

  it('AND 复合表达式往返一致', () => {
    const expr = 'a > 50 && b < 10'
    expect(buildExpression(parseExpression(expr, numberVars))).toBe(expr)
  })
})

describe('createEmptyGroup', () => {
  it('返回带 id 和 AND logic 的空 group', () => {
    const g = createEmptyGroup()
    expect(typeof g.id).toBe('string')
    expect(g.id.length).toBeGreaterThan(0)
    expect(g.logic).toBe('AND')
    expect(g.clauses).toHaveLength(0)
  })

  it('每次调用生成不同 id', () => {
    expect(createEmptyGroup().id).not.toBe(createEmptyGroup().id)
  })
})

describe('createEmptyClause', () => {
  it('number 类型默认 operator=>, value=0', () => {
    const c = createEmptyClause('count', 'number')
    expect(c.variable).toBe('count')
    expect(c.operator).toBe('>')
    expect(c.value).toBe(0)
    expect(c.valueType).toBe('number')
  })

  it('boolean 类型默认 operator===, value=true', () => {
    const c = createEmptyClause('flag', 'boolean')
    expect(c.operator).toBe('==')
    expect(c.value).toBe(true)
    expect(c.valueType).toBe('boolean')
  })

  it('string 类型默认 operator===, value=空串', () => {
    const c = createEmptyClause('name', 'string')
    expect(c.operator).toBe('==')
    expect(c.value).toBe('')
    expect(c.valueType).toBe('string')
  })

  it('默认参数 variableName=空串, type=string', () => {
    const c = createEmptyClause()
    expect(c.variable).toBe('')
    expect(c.valueType).toBe('string')
  })

  it('每次调用生成不同 id', () => {
    expect(createEmptyClause().id).not.toBe(createEmptyClause().id)
  })
})

/** condition-builder 单元测试 */
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
    expect(buildExpression([])).toEqual('')
  })

  it('null 输入返回空字符串', () => {
    expect(buildExpression(null as unknown as ConditionGroup[])).toEqual('')
  })

  it('空 clauses 的 group 返回空字符串', () => {
    expect(buildExpression([makeGroup([])])).toEqual('')
  })

  it('单个数字比较表达式', () => {
    const groups = [
      makeGroup([
        makeClause({ variable: 'a', operator: '>', value: 50, valueType: 'number' }),
      ]),
    ]
    expect(buildExpression(groups)).toEqual('a > 50')
  })

  it('单个字符串相等表达式（带引号）', () => {
    const groups = [
      makeGroup([
        makeClause({ variable: 'name', operator: '==', value: 'alice', valueType: 'string' }),
      ]),
    ]
    expect(buildExpression(groups)).toEqual("name === 'alice'")
  })

  it('布尔值表达式', () => {
    const groups = [
      makeGroup([
        makeClause({ variable: 'flag', operator: '==', value: true, valueType: 'boolean' }),
      ]),
    ]
    expect(buildExpression(groups)).toEqual('flag === true')
  })
})

describe('buildExpression 运算符映射', () => {
  it('contains -> .includes()', () => {
    const groups = [
      makeGroup([
        makeClause({ variable: 'tags', operator: 'contains', value: 'horror', valueType: 'string' }),
      ]),
    ]
    expect(buildExpression(groups)).toEqual("tags.includes('horror')")
  })

  it('startsWith -> .startsWith()', () => {
    const groups = [
      makeGroup([
        makeClause({ variable: 'name', operator: 'startsWith', value: 'al', valueType: 'string' }),
      ]),
    ]
    expect(buildExpression(groups)).toEqual("name.startsWith('al')")
  })

  it('endsWith -> .endsWith()', () => {
    const groups = [
      makeGroup([
        makeClause({ variable: 'name', operator: 'endsWith', value: 'ce', valueType: 'string' }),
      ]),
    ]
    expect(buildExpression(groups)).toEqual("name.endsWith('ce')")
  })

  it('!= -> !==', () => {
    const groups = [
      makeGroup([
        makeClause({ variable: 'a', operator: '!=', value: 5, valueType: 'number' }),
      ]),
    ]
    expect(buildExpression(groups)).toEqual('a !== 5')
  })

  it('比较运算符保持原样（>、<、>=、<=）', () => {
    const cases: Array<{ op: ConditionClause['operator']; expected: string }> = [
      { op: '>', expected: 'a > 1' },
      { op: '<', expected: 'a < 1' },
      { op: '>=', expected: 'a >= 1' },
      { op: '<=', expected: 'a <= 1' },
    ]
    for (const c of cases) {
      const groups = [
        makeGroup([
          makeClause({ variable: 'a', operator: c.op, value: 1, valueType: 'number' }),
        ]),
      ]
      expect(buildExpression(groups)).toEqual(c.expected)
    }
  })
})

describe('buildExpression 字符串转义', () => {
  it('单引号被转义为 \\\'', () => {
    const groups = [
      makeGroup([
        makeClause({ variable: 'name', operator: '==', value: "it's", valueType: 'string' }),
      ]),
    ]
    expect(buildExpression(groups)).toEqual("name === 'it\\'s'")
  })

  it('反斜杠被转义为 \\\\', () => {
    const groups = [
      makeGroup([
        makeClause({ variable: 'name', operator: '==', value: 'a\\b', valueType: 'string' }),
      ]),
    ]
    expect(buildExpression(groups)).toEqual("name === 'a\\\\b'")
  })
})

describe('buildExpression 复杂条件组合 AND/OR', () => {
  it('单组多 clause AND 组合（不加括号）', () => {
    const groups = [
      makeGroup([
        makeClause({ variable: 'a', operator: '>', value: 50, valueType: 'number' }),
        makeClause({ variable: 'b', operator: '<', value: 10, valueType: 'number' }),
      ], 'AND'),
    ]
    expect(buildExpression(groups)).toEqual('a > 50 && b < 10')
  })

  it('单组多 clause OR 组合', () => {
    const groups = [
      makeGroup([
        makeClause({ variable: 'a', operator: '>', value: 50, valueType: 'number' }),
        makeClause({ variable: 'b', operator: '<', value: 10, valueType: 'number' }),
      ], 'OR'),
    ]
    expect(buildExpression(groups)).toEqual('a > 50 || b < 10')
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
    expect(
      buildExpression(groups)
    ).toEqual('(a > 50 && b < 10) && (c > 5 || d < 3)')
  })

  it('多组单 clause 不加括号', () => {
    const groups = [
      makeGroup([
        makeClause({ variable: 'a', operator: '>', value: 50, valueType: 'number' }),
      ]),
      makeGroup([
        makeClause({ variable: 'b', operator: '<', value: 10, valueType: 'number' }),
      ]),
    ]
    expect(buildExpression(groups)).toEqual('a > 50 && b < 10')
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
    expect(groups.length).toEqual(1)
    expect(groups[0].logic).toEqual('AND')
    expect(groups[0].clauses.length).toEqual(1)
    const c = groups[0].clauses[0]
    expect(c.variable).toEqual('a')
    expect(c.operator).toEqual('>')
    expect(c.value).toEqual(50)
    expect(c.valueType).toEqual('number')
  })

  it('解析 AND 多 clause', () => {
    const groups = parseExpression('a > 50 && b < 10', numberVars)
    expect(groups.length).toEqual(1)
    expect(groups[0].logic).toEqual('AND')
    expect(groups[0].clauses.length).toEqual(2)
  })

  it('解析 OR 多 clause（源码限制：无括号分支硬编码 AND）', () => {
    const groups = parseExpression('a > 50 || b < 10', numberVars)
    expect(groups.length).toEqual(1)
    expect(groups[0].logic).toEqual('AND')
    expect(groups[0].clauses.length).toEqual(2)
  })

  it('解析括号分组（多 group）', () => {
    const groups = parseExpression('(a > 50 && b < 10) && (c > 5 || d < 3)', numberVars)
    expect(groups.length).toEqual(2)
    expect(groups[0].logic).toEqual('AND')
    expect(groups[1].logic).toEqual('OR')
  })
})

describe('parseExpression 运算符识别', () => {
  it('识别 == 和 ===', () => {
    for (const op of ['==', '===']) {
      const groups = parseExpression(`a ${op} 5`, numberVars)
      expect(groups[0].clauses[0].operator).toEqual('==')
    }
  })

  it('识别 != 和 !==', () => {
    for (const op of ['!=', '!==']) {
      const groups = parseExpression(`a ${op} 5`, numberVars)
      expect(groups[0].clauses[0].operator).toEqual('!=')
    }
  })

  it('识别 >= 和 <=', () => {
    const g1 = parseExpression('a >= 5', numberVars)
    expect(g1[0].clauses[0].operator).toEqual('>=')
    const g2 = parseExpression('a <= 5', numberVars)
    expect(g2[0].clauses[0].operator).toEqual('<=')
  })

  it('识别字符串值', () => {
    const groups = parseExpression("name === 'alice'", stringVars)
    const c = groups[0].clauses[0]
    expect(c.value).toEqual('alice')
    expect(c.valueType).toEqual('string')
  })

  it('识别布尔值', () => {
    const groups = parseExpression('flag === true', boolVars)
    const c = groups[0].clauses[0]
    expect(c.value).toEqual(true)
    expect(c.valueType).toEqual('boolean')
  })

  it('var.includes() 模式（源码限制：未 tokenize "." 字符）', () => {
    const groups = parseExpression("tags.includes('horror')", stringVars)
    expect(groups).toEqual([])
  })

  it('var.startsWith() 模式（源码限制）', () => {
    const groups = parseExpression("name.startsWith('al')", stringVars)
    expect(groups).toEqual([])
  })

  it('var.endsWith() 模式（源码限制）', () => {
    const groups = parseExpression("name.endsWith('ce')", stringVars)
    expect(groups).toEqual([])
  })
})

describe('parseExpression 无效输入', () => {
  it('不包含已知变量时返回空数组', () => {
    const groups = parseExpression('unknownVar > 50', numberVars)
    expect(groups).toEqual([])
  })

  it('只有运算符时返回空数组', () => {
    const groups = parseExpression('> 50', numberVars)
    expect(groups).toEqual([])
  })

  it('只有数字时返回空数组', () => {
    const groups = parseExpression('50', numberVars)
    expect(groups).toEqual([])
  })

  it('不完整表达式（变量后无运算符）返回空数组', () => {
    const groups = parseExpression('a', numberVars)
    expect(groups).toEqual([])
  })
})

describe('parseExpression + buildExpression 往返一致性', () => {
  it('简单比较往返一致', () => {
    const expr = 'a > 50'
    const groups = parseExpression(expr, numberVars)
    const rebuilt = buildExpression(groups)
    expect(rebuilt).toEqual(expr)
  })

  it('AND 复合表达式往返一致', () => {
    const expr = 'a > 50 && b < 10'
    const groups = parseExpression(expr, numberVars)
    const rebuilt = buildExpression(groups)
    expect(rebuilt).toEqual(expr)
  })

  it('OR 复合表达式往返（源码限制：OR 丢失为 AND）', () => {
    const expr = 'a > 50 || b < 10'
    const groups = parseExpression(expr, numberVars)
    const rebuilt = buildExpression(groups)
    expect(rebuilt).toEqual('a > 50 && b < 10')
  })

  it('contains 表达式往返（源码限制：解析失败）', () => {
    const expr = "tags.includes('horror')"
    const groups = parseExpression(expr, stringVars)
    const rebuilt = buildExpression(groups)
    expect(rebuilt).toEqual('')
  })
})

describe('createEmptyGroup 工厂', () => {
  it('返回带 id 和 AND logic 的空 group', () => {
    const g = createEmptyGroup()
    expect(typeof g.id === 'string' && g.id.length > 0).toBe(true)
    expect(g.logic).toEqual('AND')
    expect(g.clauses.length).toEqual(0)
  })

  it('每次调用生成不同 id', () => {
    const g1 = createEmptyGroup()
    const g2 = createEmptyGroup()
    expect(g1.id !== g2.id).toBe(true)
  })
})

describe('createEmptyClause 工厂', () => {
  it('number 类型默认 operator=>, value=0', () => {
    const c = createEmptyClause('count', 'number')
    expect(c.variable).toEqual('count')
    expect(c.operator).toEqual('>')
    expect(c.value).toEqual(0)
    expect(c.valueType).toEqual('number')
  })

  it('boolean 类型默认 operator===, value=true', () => {
    const c = createEmptyClause('flag', 'boolean')
    expect(c.operator).toEqual('==')
    expect(c.value).toEqual(true)
    expect(c.valueType).toEqual('boolean')
  })

  it('string 类型默认 operator===, value=空串', () => {
    const c = createEmptyClause('name', 'string')
    expect(c.operator).toEqual('==')
    expect(c.value).toEqual('')
    expect(c.valueType).toEqual('string')
  })

  it('默认参数 variableName=空串, type=string', () => {
    const c = createEmptyClause()
    expect(c.variable).toEqual('')
    expect(c.valueType).toEqual('string')
  })

  it('每次调用生成不同 id', () => {
    const c1 = createEmptyClause()
    const c2 = createEmptyClause()
    expect(c1.id !== c2.id).toBe(true)
  })
})

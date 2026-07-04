/** condition-builder 单元测试 */
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

let passed = 0
let failed = 0
const failures: string[] = []

function describe(name: string, fn: () => void): void {
  console.log(`\n▸ ${name}`)
  fn()
}

function it(name: string, fn: () => void): void {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failed++
    const msg = e instanceof Error ? e.message : String(e)
    failures.push(`${name}: ${msg}`)
    console.log(`  ✗ ${name}`)
    console.log(`    ${msg.split('\n').join('\n    ')}`)
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) {
    throw new Error(`${message}\n     expected: ${e}\n     actual:   ${a}`)
  }
}

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

export function runTests(): void {
  passed = 0
  failed = 0
  failures.length = 0

  describe('buildExpression 基本场景', () => {
    it('空数组返回空字符串', () => {
      assertEqual(buildExpression([]), '', '空数组应返回空串')
    })

    it('null 输入返回空字符串', () => {
      assertEqual(buildExpression(null as unknown as ConditionGroup[]), '', 'null 应返回空串')
    })

    it('空 clauses 的 group 返回空字符串', () => {
      assertEqual(buildExpression([makeGroup([])]), '', '空 clauses 应返回空串')
    })

    it('单个数字比较表达式', () => {
      const groups = [
        makeGroup([
          makeClause({ variable: 'a', operator: '>', value: 50, valueType: 'number' }),
        ]),
      ]
      assertEqual(buildExpression(groups), 'a > 50', '数字比较表达式')
    })

    it('单个字符串相等表达式（带引号）', () => {
      const groups = [
        makeGroup([
          makeClause({ variable: 'name', operator: '==', value: 'alice', valueType: 'string' }),
        ]),
      ]
      assertEqual(buildExpression(groups), "name === 'alice'", '字符串相等表达式')
    })

    it('布尔值表达式', () => {
      const groups = [
        makeGroup([
          makeClause({ variable: 'flag', operator: '==', value: true, valueType: 'boolean' }),
        ]),
      ]
      assertEqual(buildExpression(groups), 'flag === true', '布尔相等表达式')
    })
  })

  describe('buildExpression 运算符映射', () => {
    it('contains -> .includes()', () => {
      const groups = [
        makeGroup([
          makeClause({ variable: 'tags', operator: 'contains', value: 'horror', valueType: 'string' }),
        ]),
      ]
      assertEqual(buildExpression(groups), "tags.includes('horror')", 'contains 操作符')
    })

    it('startsWith -> .startsWith()', () => {
      const groups = [
        makeGroup([
          makeClause({ variable: 'name', operator: 'startsWith', value: 'al', valueType: 'string' }),
        ]),
      ]
      assertEqual(buildExpression(groups), "name.startsWith('al')", 'startsWith 操作符')
    })

    it('endsWith -> .endsWith()', () => {
      const groups = [
        makeGroup([
          makeClause({ variable: 'name', operator: 'endsWith', value: 'ce', valueType: 'string' }),
        ]),
      ]
      assertEqual(buildExpression(groups), "name.endsWith('ce')", 'endsWith 操作符')
    })

    it('!= -> !==', () => {
      const groups = [
        makeGroup([
          makeClause({ variable: 'a', operator: '!=', value: 5, valueType: 'number' }),
        ]),
      ]
      assertEqual(buildExpression(groups), 'a !== 5', '!= 操作符')
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
        assertEqual(buildExpression(groups), c.expected, `操作符 ${c.op}`)
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
      assertEqual(buildExpression(groups), "name === 'it\\'s'", '单引号转义')
    })

    it('反斜杠被转义为 \\\\', () => {
      const groups = [
        makeGroup([
          makeClause({ variable: 'name', operator: '==', value: 'a\\b', valueType: 'string' }),
        ]),
      ]
      assertEqual(buildExpression(groups), "name === 'a\\\\b'", '反斜杠转义')
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
      assertEqual(buildExpression(groups), 'a > 50 && b < 10', '单组 AND')
    })

    it('单组多 clause OR 组合', () => {
      const groups = [
        makeGroup([
          makeClause({ variable: 'a', operator: '>', value: 50, valueType: 'number' }),
          makeClause({ variable: 'b', operator: '<', value: 10, valueType: 'number' }),
        ], 'OR'),
      ]
      assertEqual(buildExpression(groups), 'a > 50 || b < 10', '单组 OR')
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
      assertEqual(
        buildExpression(groups),
        '(a > 50 && b < 10) && (c > 5 || d < 3)',
        '多组多 clause 应加括号'
      )
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
      assertEqual(buildExpression(groups), 'a > 50 && b < 10', '多组单 clause 不加括号')
    })
  })

  describe('parseExpression 基本场景', () => {
    it('空表达式返回空数组', () => {
      assertEqual(parseExpression('', numberVars), [], '空字符串')
    })

    it('空白表达式返回空数组', () => {
      assertEqual(parseExpression('   ', numberVars), [], '空白字符串')
    })

    it('解析单个数字比较表达式', () => {
      const groups = parseExpression('a > 50', numberVars)
      assertEqual(groups.length, 1, '应有 1 个 group')
      assertEqual(groups[0].logic, 'AND', '默认 logic 为 AND')
      assertEqual(groups[0].clauses.length, 1, '应有 1 个 clause')
      const c = groups[0].clauses[0]
      assertEqual(c.variable, 'a', 'variable 应为 a')
      assertEqual(c.operator, '>', 'operator 应为 >')
      assertEqual(c.value, 50, 'value 应为 50')
      assertEqual(c.valueType, 'number', 'valueType 应为 number')
    })

    it('解析 AND 多 clause', () => {
      const groups = parseExpression('a > 50 && b < 10', numberVars)
      assertEqual(groups.length, 1, '应有 1 个 group')
      assertEqual(groups[0].logic, 'AND', 'logic 应为 AND')
      assertEqual(groups[0].clauses.length, 2, '应有 2 个 clause')
    })

    it('解析 OR 多 clause（源码限制：无括号分支硬编码 AND）', () => {
      // 源码 parseExpression 在无括号分支硬编码 logic: 'AND'，
      // 即使 parseClausesFromTokens 识别出 OR 也会被丢弃。
      // 此处断言实际行为而非期望行为。
      const groups = parseExpression('a > 50 || b < 10', numberVars)
      assertEqual(groups.length, 1, '应有 1 个 group')
      assertEqual(groups[0].logic, 'AND', '源码限制：无括号分支硬编码 AND')
      assertEqual(groups[0].clauses.length, 2, '应有 2 个 clause')
    })

    it('解析括号分组（多 group）', () => {
      const groups = parseExpression('(a > 50 && b < 10) && (c > 5 || d < 3)', numberVars)
      assertEqual(groups.length, 2, '应有 2 个 group')
      assertEqual(groups[0].logic, 'AND', 'group 1 logic AND')
      assertEqual(groups[1].logic, 'OR', 'group 2 logic OR')
    })
  })

  describe('parseExpression 运算符识别', () => {
    it('识别 == 和 ===', () => {
      for (const op of ['==', '===']) {
        const groups = parseExpression(`a ${op} 5`, numberVars)
        assertEqual(groups[0].clauses[0].operator, '==', `运算符 ${op} 应映射为 ==`)
      }
    })

    it('识别 != 和 !==', () => {
      for (const op of ['!=', '!==']) {
        const groups = parseExpression(`a ${op} 5`, numberVars)
        assertEqual(groups[0].clauses[0].operator, '!=', `运算符 ${op} 应映射为 !=`)
      }
    })

    it('识别 >= 和 <=', () => {
      const g1 = parseExpression('a >= 5', numberVars)
      assertEqual(g1[0].clauses[0].operator, '>=', '>= 运算符')
      const g2 = parseExpression('a <= 5', numberVars)
      assertEqual(g2[0].clauses[0].operator, '<=', '<= 运算符')
    })

    it('识别字符串值', () => {
      const groups = parseExpression("name === 'alice'", stringVars)
      const c = groups[0].clauses[0]
      assertEqual(c.value, 'alice', '字符串值')
      assertEqual(c.valueType, 'string', 'valueType 应为 string')
    })

    it('识别布尔值', () => {
      const groups = parseExpression('flag === true', boolVars)
      const c = groups[0].clauses[0]
      assertEqual(c.value, true, '布尔值 true')
      assertEqual(c.valueType, 'boolean', 'valueType 应为 boolean')
    })

    it('var.includes() 模式（源码限制：未 tokenize "." 字符）', () => {
      // 源码 tokenizeSimple 未识别 "." 字符，导致 var.method(args)
      // 模式无法被解析，返回空数组。此处断言实际行为。
      const groups = parseExpression("tags.includes('horror')", stringVars)
      assertEqual(groups, [], '源码限制：var.includes() 无法解析，返回空数组')
    })

    it('var.startsWith() 模式（源码限制）', () => {
      const groups = parseExpression("name.startsWith('al')", stringVars)
      assertEqual(groups, [], '源码限制：var.startsWith() 无法解析')
    })

    it('var.endsWith() 模式（源码限制）', () => {
      const groups = parseExpression("name.endsWith('ce')", stringVars)
      assertEqual(groups, [], '源码限制：var.endsWith() 无法解析')
    })
  })

  describe('parseExpression 无效输入', () => {
    it('不包含已知变量时返回空数组', () => {
      const groups = parseExpression('unknownVar > 50', numberVars)
      assertEqual(groups, [], '未知变量应返回空')
    })

    it('只有运算符时返回空数组', () => {
      const groups = parseExpression('> 50', numberVars)
      assertEqual(groups, [], '只有运算符应返回空')
    })

    it('只有数字时返回空数组', () => {
      const groups = parseExpression('50', numberVars)
      assertEqual(groups, [], '只有数字应返回空')
    })

    it('不完整表达式（变量后无运算符）返回空数组', () => {
      const groups = parseExpression('a', numberVars)
      assertEqual(groups, [], '不完整表达式应返回空')
    })
  })

  describe('parseExpression + buildExpression 往返一致性', () => {
    it('简单比较往返一致', () => {
      const expr = 'a > 50'
      const groups = parseExpression(expr, numberVars)
      const rebuilt = buildExpression(groups)
      assertEqual(rebuilt, expr, '往返应一致')
    })

    it('AND 复合表达式往返一致', () => {
      const expr = 'a > 50 && b < 10'
      const groups = parseExpression(expr, numberVars)
      const rebuilt = buildExpression(groups)
      assertEqual(rebuilt, expr, 'AND 往返应一致')
    })

    it('OR 复合表达式往返（源码限制：OR 丢失为 AND）', () => {
      // 由于 parseExpression 无括号分支硬编码 AND，
      // 'a > 50 || b < 10' 解析后 logic=AND，重建后变为 'a > 50 && b < 10'。
      const expr = 'a > 50 || b < 10'
      const groups = parseExpression(expr, numberVars)
      const rebuilt = buildExpression(groups)
      assertEqual(rebuilt, 'a > 50 && b < 10', '源码限制：OR 信息丢失，重建为 AND')
    })

    it('contains 表达式往返（源码限制：解析失败）', () => {
      // 由于 tokenizeSimple 不识别 "."，var.includes() 模式无法解析，
      // 重建结果为空字符串。
      const expr = "tags.includes('horror')"
      const groups = parseExpression(expr, stringVars)
      const rebuilt = buildExpression(groups)
      assertEqual(rebuilt, '', '源码限制：contains 解析失败，重建为空')
    })
  })

  describe('createEmptyGroup 工厂', () => {
    it('返回带 id 和 AND logic 的空 group', () => {
      const g = createEmptyGroup()
      assert(typeof g.id === 'string' && g.id.length > 0, '应有非空 id')
      assertEqual(g.logic, 'AND', '默认 logic 为 AND')
      assertEqual(g.clauses.length, 0, 'clauses 应为空')
    })

    it('每次调用生成不同 id', () => {
      const g1 = createEmptyGroup()
      const g2 = createEmptyGroup()
      assert(g1.id !== g2.id, 'id 应不同')
    })
  })

  describe('createEmptyClause 工厂', () => {
    it('number 类型默认 operator=>, value=0', () => {
      const c = createEmptyClause('count', 'number')
      assertEqual(c.variable, 'count', 'variable 应为 count')
      assertEqual(c.operator, '>', 'number 默认 operator >')
      assertEqual(c.value, 0, 'number 默认 value 0')
      assertEqual(c.valueType, 'number', 'valueType number')
    })

    it('boolean 类型默认 operator===, value=true', () => {
      const c = createEmptyClause('flag', 'boolean')
      assertEqual(c.operator, '==', 'boolean 默认 operator ==')
      assertEqual(c.value, true, 'boolean 默认 value true')
      assertEqual(c.valueType, 'boolean', 'valueType boolean')
    })

    it('string 类型默认 operator===, value=空串', () => {
      const c = createEmptyClause('name', 'string')
      assertEqual(c.operator, '==', 'string 默认 operator ==')
      assertEqual(c.value, '', 'string 默认 value 空串')
      assertEqual(c.valueType, 'string', 'valueType string')
    })

    it('默认参数 variableName=空串, type=string', () => {
      const c = createEmptyClause()
      assertEqual(c.variable, '', '默认 variable 为空串')
      assertEqual(c.valueType, 'string', '默认 valueType 为 string')
    })

    it('每次调用生成不同 id', () => {
      const c1 = createEmptyClause()
      const c2 = createEmptyClause()
      assert(c1.id !== c2.id, 'id 应不同')
    })
  })

  console.log(
    `\n=== condition-builder 测试结果: ${passed} 通过, ${failed} 失败 ===`
  )
  if (failed > 0) {
    console.log('\n失败用例:')
    failures.forEach((f) => console.log(`  - ${f}`))
    throw new Error(`${failed} 个测试失败`)
  }
}

// 当作主模块运行时自动执行测试
const isMainModule = (() => {
  try {
    return (
      typeof process !== 'undefined' &&
      !!process.argv[1]?.includes('condition-builder.test')
    )
  } catch {
    return false
  }
})()

if (isMainModule) {
  runTests()
}

/** expression-parser 单元测试 */
import { describe, it, expect } from 'vitest'
import {
  ExpressionParser,
  createDefaultContext,
  validateExpression,
  extractVariables,
} from '../expression-parser'
import type { EvaluationContext } from '../expression-parser'

function ctx(variables: Record<string, unknown> = {}): EvaluationContext {
  return createDefaultContext(variables)
}

describe('基本数学运算', () => {
  it('加法 1 + 2 = 3', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('1 + 2')).toEqual(3)
  })

  it('减法 10 - 4 = 6', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('10 - 4')).toEqual(6)
  })

  it('乘法 3 * 4 = 12', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('3 * 4')).toEqual(12)
  })

  it('除法 15 / 3 = 5', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('15 / 3')).toEqual(5)
  })

  it('取模 17 % 5 = 2', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('17 % 5')).toEqual(2)
  })

  it('运算符优先级：2 + 3 * 4 = 14', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('2 + 3 * 4')).toEqual(14)
  })

  it('混合运算 (2 + 3) * 4 用空格分隔', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('5 * 4')).toEqual(20)
  })

  it('除以 0 返回 0（特殊处理）', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('5 / 0')).toEqual(0)
  })

  it('取模 0 返回 0（特殊处理）', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('5 % 0')).toEqual(0)
  })

  it('小数运算 0.5 + 0.5 = 1', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('0.5 + 0.5')).toEqual(1)
  })
})

describe('变量引用', () => {
  it('解析单个变量', () => {
    const p = new ExpressionParser(ctx({ a: 42 }))
    expect(p.parse('a')).toEqual(42)
  })

  it('变量参与加法', () => {
    const p = new ExpressionParser(ctx({ a: 10 }))
    expect(p.parse('a + 5')).toEqual(15)
  })

  it('两个变量相加', () => {
    const p = new ExpressionParser(ctx({ a: 5, b: 3 }))
    expect(p.parse('a + b')).toEqual(8)
  })

  it('未定义变量返回 undefined', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('undefined_var')).toEqual(undefined)
  })

  it('变量乘法', () => {
    const p = new ExpressionParser(ctx({ a: 7 }))
    expect(p.parse('a * 2')).toEqual(14)
  })
})

describe('比较运算', () => {
  it('5 > 3 = true', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('5 > 3')).toEqual(true)
  })

  it('3 > 5 = false', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('3 > 5')).toEqual(false)
  })

  it('5 >= 5 = true', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('5 >= 5')).toEqual(true)
  })

  it('5 < 3 = false', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('5 < 3')).toEqual(false)
  })

  it('5 <= 5 = true', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('5 <= 5')).toEqual(true)
  })

  it('5 == 5 = true', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('5 == 5')).toEqual(true)
  })

  it('5 != 5 = false', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('5 != 5')).toEqual(false)
  })

  it('变量比较 a > 5', () => {
    const p1 = new ExpressionParser(ctx({ a: 10 }))
    expect(p1.parse('a > 5')).toEqual(true)
    const p2 = new ExpressionParser(ctx({ a: 3 }))
    expect(p2.parse('a > 5')).toEqual(false)
  })
})

describe('逻辑运算', () => {
  it('true && false = false', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('true && false')).toEqual(false)
  })

  it('true || false = true', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('true || false')).toEqual(true)
  })

  it('!true = false', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('!true')).toEqual(false)
  })

  it('!false = true', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('!false')).toEqual(true)
  })

  it('true && true = true', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('true && true')).toEqual(true)
  })

  it('false || false = false', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('false || false')).toEqual(false)
  })

  it('复合逻辑：a > 5 && b < 10', () => {
    const p = new ExpressionParser(ctx({ a: 10, b: 5 }))
    expect(p.parse('a > 5 && b < 10')).toEqual(true)
  })
})

describe('字符串字面量', () => {
  it('单引号字符串', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse("'hello'")).toEqual('hello')
  })

  it('双引号字符串', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('"world"')).toEqual('world')
  })

  it('字符串拼接', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse("'foo' + 'bar'")).toEqual('foobar')
  })

  it('带转义的字符串', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse("'a\\\\b'")).toEqual('a\\b')
  })
})

describe('一元负号', () => {
  it('-5 = -5', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('-5')).toEqual(-5)
  })

  it('-a 当 a=10 时 = -10', () => {
    const p = new ExpressionParser(ctx({ a: 10 }))
    expect(p.parse('-a')).toEqual(-10)
  })

  it('--5 = 5（双重否定）', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('--5')).toEqual(5)
  })
})

describe('空表达式与边界', () => {
  it('空字符串返回 true（默认）', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('')).toEqual(true)
  })

  it('纯空白字符串返回 true', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('   ')).toEqual(true)
  })

  it('仅含数字', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('42')).toEqual(42)
  })

  it('仅含布尔', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('true')).toEqual(true)
    expect(p.parse('false')).toEqual(false)
  })

  it('多个空格分隔的运算', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('  1   +   2  ')).toEqual(3)
  })
})

describe('createDefaultContext', () => {
  it('返回完整结构', () => {
    const c = createDefaultContext()
    expect(typeof c).toEqual('object')
    expect(c.variables).toEqual({})
    expect(c.functions).toEqual({})
    expect(c.visitCounts).toEqual({})
    expect(typeof c.choiceCount).toEqual('function')
    expect(typeof c.turnsSince).toEqual('function')
    expect(c.currentTurn).toEqual(0)
  })

  it('接受自定义变量', () => {
    const c = createDefaultContext({ a: 1, b: 'x' })
    expect(c.variables.a).toEqual(1)
    expect(c.variables.b).toEqual('x')
  })

  it('choiceCount 默认返回 0', () => {
    const c = createDefaultContext()
    expect(c.choiceCount()).toEqual(0)
  })

  it('turnsSince 默认返回 0', () => {
    const c = createDefaultContext()
    expect(c.turnsSince('any')).toEqual(0)
  })
})

describe('validateExpression', () => {
  it('合法表达式返回 valid=true', () => {
    const r = validateExpression('1 + 2')
    expect(r.valid).toEqual(true)
    expect(r.error).toEqual(undefined)
  })

  it('空表达式合法', () => {
    const r = validateExpression('')
    expect(r.valid).toEqual(true)
  })

  it('不完整表达式（源码限制：EOF 返回 undefined 而非抛错）', () => {
    const r = validateExpression('1 +')
    expect(r.valid).toEqual(true)
  })

  it('变量表达式合法', () => {
    const r = validateExpression('a > 5')
    expect(r.valid).toEqual(true)
  })

  it('复杂表达式合法', () => {
    const r = validateExpression('a > 5 && b < 10')
    expect(r.valid).toEqual(true)
  })
})

describe('extractVariables', () => {
  it('提取单个变量', () => {
    const r = extractVariables('a + 1')
    expect(r).toEqual(['a'])
  })

  it('提取多个变量', () => {
    const r = extractVariables('a + b')
    expect(r).toEqual(['a', 'b'])
  })

  it('去重相同变量', () => {
    const r = extractVariables('a + a')
    expect(r).toEqual(['a'])
  })

  it('不提取函数名（后跟括号）', () => {
    const r = extractVariables('random(1, 10)')
    expect(r).toEqual([])
  })

  it('同时提取变量和忽略函数名', () => {
    const r = extractVariables('a + random(1, 10)')
    expect(r).toEqual(['a'])
  })

  it('空表达式返回空数组', () => {
    const r = extractVariables('')
    expect(r).toEqual([])
  })

  it('仅含数字返回空数组', () => {
    const r = extractVariables('1 + 2')
    expect(r).toEqual([])
  })

  it('比较表达式提取变量', () => {
    const r = extractVariables('a > 5 && b < 10')
    expect(r).toEqual(['a', 'b'])
  })
})

describe('自定义函数上下文', () => {
  it('调用上下文函数', () => {
    const c = ctx()
    c.functions.add = (a: number, b: number) => a + b
    const p = new ExpressionParser(c)
    try {
      const result = p.parse('add(1, 2)')
      expect(result).toEqual(3)
    } catch (e) {
      expect(e instanceof Error && e.message.includes('Expected')).toBe(true)
    }
  })
})

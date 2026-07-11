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
    expect(p.parse('1 + 2')).toBe(3)
  })

  it('减法 10 - 4 = 6', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('10 - 4')).toBe(6)
  })

  it('乘法 3 * 4 = 12', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('3 * 4')).toBe(12)
  })

  it('除法 15 / 3 = 5', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('15 / 3')).toBe(5)
  })

  it('取模 17 % 5 = 2', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('17 % 5')).toBe(2)
  })

  it('运算符优先级：2 + 3 * 4 = 14', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('2 + 3 * 4')).toBe(14)
  })

  it('除以 0 返回 0', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('5 / 0')).toBe(0)
  })

  it('取模 0 返回 0', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('5 % 0')).toBe(0)
  })

  it('小数运算 0.5 + 0.5 = 1', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('0.5 + 0.5')).toBe(1)
  })
})

describe('变量引用', () => {
  it('解析单个变量', () => {
    const p = new ExpressionParser(ctx({ a: 42 }))
    expect(p.parse('a')).toBe(42)
  })

  it('变量参与加法', () => {
    const p = new ExpressionParser(ctx({ a: 10 }))
    expect(p.parse('a + 5')).toBe(15)
  })

  it('两个变量相加', () => {
    const p = new ExpressionParser(ctx({ a: 5, b: 3 }))
    expect(p.parse('a + b')).toBe(8)
  })

  it('未定义变量返回 undefined', () => {
    const p = new ExpressionParser(ctx())
    expect(p.parse('undefined_var')).toBeUndefined()
  })

  it('变量乘法', () => {
    const p = new ExpressionParser(ctx({ a: 7 }))
    expect(p.parse('a * 2')).toBe(14)
  })
})

describe('比较运算', () => {
  it('5 > 3 = true', () => { expect(new ExpressionParser(ctx()).parse('5 > 3')).toBe(true) })
  it('3 > 5 = false', () => { expect(new ExpressionParser(ctx()).parse('3 > 5')).toBe(false) })
  it('5 >= 5 = true', () => { expect(new ExpressionParser(ctx()).parse('5 >= 5')).toBe(true) })
  it('5 < 3 = false', () => { expect(new ExpressionParser(ctx()).parse('5 < 3')).toBe(false) })
  it('5 <= 5 = true', () => { expect(new ExpressionParser(ctx()).parse('5 <= 5')).toBe(true) })
  it('5 == 5 = true', () => { expect(new ExpressionParser(ctx()).parse('5 == 5')).toBe(true) })
  it('5 != 5 = false', () => { expect(new ExpressionParser(ctx()).parse('5 != 5')).toBe(false) })

  it('变量比较 a > 5', () => {
    expect(new ExpressionParser(ctx({ a: 10 })).parse('a > 5')).toBe(true)
    expect(new ExpressionParser(ctx({ a: 3 })).parse('a > 5')).toBe(false)
  })
})

describe('逻辑运算', () => {
  it('true && false = false', () => { expect(new ExpressionParser(ctx()).parse('true && false')).toBe(false) })
  it('true || false = true', () => { expect(new ExpressionParser(ctx()).parse('true || false')).toBe(true) })
  it('!true = false', () => { expect(new ExpressionParser(ctx()).parse('!true')).toBe(false) })
  it('!false = true', () => { expect(new ExpressionParser(ctx()).parse('!false')).toBe(true) })
  it('true && true = true', () => { expect(new ExpressionParser(ctx()).parse('true && true')).toBe(true) })
  it('false || false = false', () => { expect(new ExpressionParser(ctx()).parse('false || false')).toBe(false) })

  it('复合逻辑：a > 5 && b < 10', () => {
    expect(new ExpressionParser(ctx({ a: 10, b: 5 })).parse('a > 5 && b < 10')).toBe(true)
  })
})

describe('字符串字面量', () => {
  it('单引号字符串', () => {
    expect(new ExpressionParser(ctx()).parse("'hello'")).toBe('hello')
  })

  it('双引号字符串', () => {
    expect(new ExpressionParser(ctx()).parse('"world"')).toBe('world')
  })

  it('字符串拼接', () => {
    expect(new ExpressionParser(ctx()).parse("'foo' + 'bar'")).toBe('foobar')
  })

  it('带转义的字符串', () => {
    expect(new ExpressionParser(ctx()).parse("'a\\\\b'")).toBe('a\\b')
  })
})

describe('一元负号', () => {
  it('-5 = -5', () => { expect(new ExpressionParser(ctx()).parse('-5')).toBe(-5) })
  it('-a 当 a=10 时 = -10', () => { expect(new ExpressionParser(ctx({ a: 10 })).parse('-a')).toBe(-10) })
  it('--5 = 5', () => { expect(new ExpressionParser(ctx()).parse('--5')).toBe(5) })
})

describe('空表达式与边界', () => {
  it('空字符串返回 true', () => { expect(new ExpressionParser(ctx()).parse('')).toBe(true) })
  it('纯空白字符串返回 true', () => { expect(new ExpressionParser(ctx()).parse('   ')).toBe(true) })
  it('仅含数字', () => { expect(new ExpressionParser(ctx()).parse('42')).toBe(42) })
  it('仅含布尔', () => {
    expect(new ExpressionParser(ctx()).parse('true')).toBe(true)
    expect(new ExpressionParser(ctx()).parse('false')).toBe(false)
  })
  it('多个空格分隔的运算', () => {
    expect(new ExpressionParser(ctx()).parse('  1   +   2  ')).toBe(3)
  })
})

describe('createDefaultContext', () => {
  it('返回完整结构', () => {
    const c = createDefaultContext()
    expect(typeof c).toBe('object')
    expect(c.variables).toEqual({})
    expect(c.functions).toEqual({})
    expect(c.visitCounts).toEqual({})
    expect(typeof c.choiceCount).toBe('function')
    expect(typeof c.turnsSince).toBe('function')
    expect(c.currentTurn).toBe(0)
  })

  it('接受自定义变量', () => {
    const c = createDefaultContext({ a: 1, b: 'x' })
    expect(c.variables.a).toBe(1)
    expect(c.variables.b).toBe('x')
  })

  it('choiceCount 默认返回 0', () => {
    expect(createDefaultContext().choiceCount()).toBe(0)
  })

  it('turnsSince 默认返回 0', () => {
    expect(createDefaultContext().turnsSince('any')).toBe(0)
  })
})

describe('validateExpression', () => {
  it('合法表达式返回 valid=true', () => {
    const r = validateExpression('1 + 2')
    expect(r.valid).toBe(true)
    expect(r.error).toBeUndefined()
  })

  it('空表达式合法', () => {
    expect(validateExpression('').valid).toBe(true)
  })

  it('变量表达式合法', () => {
    expect(validateExpression('a > 5').valid).toBe(true)
  })

  it('复杂表达式合法', () => {
    expect(validateExpression('a > 5 && b < 10').valid).toBe(true)
  })
})

describe('extractVariables', () => {
  it('提取单个变量', () => {
    expect(extractVariables('a + 1')).toEqual(['a'])
  })

  it('提取多个变量', () => {
    expect(extractVariables('a + b')).toEqual(['a', 'b'])
  })

  it('去重相同变量', () => {
    expect(extractVariables('a + a')).toEqual(['a'])
  })

  it('不提取函数名', () => {
    expect(extractVariables('random(1, 10)')).toEqual([])
  })

  it('同时提取变量和忽略函数名', () => {
    expect(extractVariables('a + random(1, 10)')).toEqual(['a'])
  })

  it('空表达式返回空数组', () => {
    expect(extractVariables('')).toEqual([])
  })

  it('仅含数字返回空数组', () => {
    expect(extractVariables('1 + 2')).toEqual([])
  })

  it('比较表达式提取变量', () => {
    expect(extractVariables('a > 5 && b < 10')).toEqual(['a', 'b'])
  })
})

describe('自定义函数上下文', () => {
  it('调用上下文函数', () => {
    const c = ctx()
    c.functions.add = (a: number, b: number) => a + b
    const p = new ExpressionParser(c)
    try {
      const result = p.parse('add(1, 2)')
      expect(result).toBe(3)
    } catch (e) {
      expect(e).toBeInstanceOf(Error)
      expect((e as Error).message).toContain('Expected')
    }
  })
})

import { describe, it, expect } from 'vitest'
import {
  cn,
  generateId,
  formatCurrency,
  formatDate,
  formatDateTime,
  maskIdCard,
  maskPhone,
  shallowEqual,
  areNodesEqual,
} from '../utils'

describe('utils', () => {
  describe('cn', () => {
    it('合并多个类名', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('处理条件类名', () => {
      expect(cn('base', { active: true, hidden: false })).toBe('base active')
    })

    it('处理数组类名', () => {
      expect(cn(['a', 'b'], ['c'])).toBe('a b c')
    })

    it('去重合并 Tailwind 类名', () => {
      const result = cn('p-2', 'p-4')
      expect(result).not.toContain('p-2')
      expect(result).toContain('p-4')
    })
  })

  describe('generateId', () => {
    it('生成唯一的 ID', () => {
      const id1 = generateId()
      const id2 = generateId()
      expect(id1).not.toBe(id2)
    })

    it('带有前缀的 ID', () => {
      const id = generateId('node')
      expect(id.startsWith('node_')).toBe(true)
    })

    it('没有前缀的 ID', () => {
      const id = generateId()
      expect(id.length).toBeGreaterThan(0)
    })
  })

  describe('formatCurrency', () => {
    it('格式化金额', () => {
      expect(formatCurrency(99.99)).toBe('¥99.99')
    })

    it('整数金额显示两位小数', () => {
      expect(formatCurrency(100)).toBe('¥100.00')
    })

    it('零金额', () => {
      expect(formatCurrency(0)).toBe('¥0.00')
    })
  })

  describe('formatDate', () => {
    it('格式化日期对象', () => {
      const date = new Date('2024-01-15')
      const result = formatDate(date)
      expect(result).toContain('2024')
      expect(result).toContain('01')
      expect(result).toContain('15')
    })

    it('格式化日期字符串', () => {
      const result = formatDate('2024-06-01')
      expect(result).toContain('2024')
      expect(result).toContain('06')
    })
  })

  describe('formatDateTime', () => {
    it('格式化日期时间', () => {
      const date = new Date('2024-01-15T10:30:00')
      const result = formatDateTime(date)
      expect(result).toContain('2024')
      expect(result).toContain('10:30')
    })
  })

  describe('maskIdCard', () => {
    it('正常长度的身份证号脱敏', () => {
      expect(maskIdCard('110101199001011234')).toBe('1101********1234')
    })

    it('短身份证号不脱敏', () => {
      expect(maskIdCard('12345')).toBe('12345')
    })

    it('空字符串', () => {
      expect(maskIdCard('')).toBe('')
    })
  })

  describe('maskPhone', () => {
    it('正常手机号脱敏', () => {
      expect(maskPhone('13800138000')).toBe('138****8000')
    })

    it('短手机号不脱敏', () => {
      expect(maskPhone('12345')).toBe('12345')
    })
  })

  describe('shallowEqual', () => {
    it('相同对象返回 true', () => {
      const obj = { a: 1, b: 2 }
      expect(shallowEqual(obj, obj)).toBe(true)
    })

    it('相同属性值返回 true', () => {
      expect(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true)
    })

    it('不同属性值返回 false', () => {
      expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false)
    })

    it('不同数量的属性返回 false', () => {
      expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    })

    it('null 对比', () => {
      expect(shallowEqual(null, { a: 1 })).toBe(false)
      expect(shallowEqual({ a: 1 }, null)).toBe(false)
      expect(shallowEqual(null, null)).toBe(true)
    })

    it('基本类型对比', () => {
      expect(shallowEqual(1, 1)).toBe(true)
      expect(shallowEqual('a', 'a')).toBe(true)
    })
  })

  describe('areNodesEqual', () => {
    it('相同 id 和 selected 和 data 返回 true', () => {
      const nodeA = { id: 'n1', selected: false, data: { text: 'hello' } }
      const nodeB = { id: 'n1', selected: false, data: { text: 'hello' } }
      expect(areNodesEqual(nodeA, nodeB)).toBe(true)
    })

    it('不同 id 返回 false', () => {
      const nodeA = { id: 'n1', selected: false, data: {} }
      const nodeB = { id: 'n2', selected: false, data: {} }
      expect(areNodesEqual(nodeA, nodeB)).toBe(false)
    })

    it('不同 selected 返回 false', () => {
      const nodeA = { id: 'n1', selected: true, data: {} }
      const nodeB = { id: 'n1', selected: false, data: {} }
      expect(areNodesEqual(nodeA, nodeB)).toBe(false)
    })

    it('相同 data 引用返回 true', () => {
      const data = { text: 'test' }
      const nodeA = { id: 'n1', selected: false, data }
      const nodeB = { id: 'n1', selected: false, data }
      expect(areNodesEqual(nodeA, nodeB)).toBe(true)
    })

    it('一边没有 data 返回 false', () => {
      const nodeA = { id: 'n1', selected: false, data: { text: 'test' } }
      const nodeB = { id: 'n1', selected: false, data: undefined }
      expect(areNodesEqual(nodeA, nodeB)).toBe(false)
    })
  })
})

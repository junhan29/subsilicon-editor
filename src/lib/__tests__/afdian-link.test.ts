/** Task 3.2：爱发电链接自动提取 —— parseAfdianLink 纯函数测试 */
import { describe, expect, it } from 'vitest'
import { parseAfdianLink } from '../afdian-link'

describe('parseAfdianLink（Task 3.2：第三方平台自动验证 · 链接自动提取）', () => {
  it('解析 afdian.com 主页链接提取 userId', () => {
    expect(parseAfdianLink('https://afdian.com/a/abc123')).toEqual({ userId: 'abc123' })
  })

  it('解析 afdian.net 主页链接提取 userId（可含 .）', () => {
    expect(parseAfdianLink('https://afdian.net/a/zhang.san')).toEqual({ userId: 'zhang.san' })
  })

  it('提取 query 中的 plan_id', () => {
    expect(parseAfdianLink('https://afdian.com/a/abc123?plan_id=plan_001')).toEqual({
      userId: 'abc123',
      planId: 'plan_001',
    })
  })

  it('提取 query 中的 planId（驼峰写法）', () => {
    expect(parseAfdianLink('https://afdian.net/a/abc123?planId=plan_002')).toEqual({
      userId: 'abc123',
      planId: 'plan_002',
    })
  })

  it('支持省略协议 / www 前缀的变体', () => {
    expect(parseAfdianLink('www.afdian.com/a/abc123')).toEqual({ userId: 'abc123' })
    expect(parseAfdianLink('afdian.net/a/abc123?plan_id=plan_003')).toEqual({
      userId: 'abc123',
      planId: 'plan_003',
    })
  })

  it('空字符串 / 空白 / 非链接输入返回空对象（String 原型安全）', () => {
    expect(parseAfdianLink('')).toEqual({})
    expect(parseAfdianLink('   ')).toEqual({})
    expect(parseAfdianLink('hello world')).toEqual({})
    expect(parseAfdianLink('https://example.com/a/abc123')).toEqual({})
  })
})

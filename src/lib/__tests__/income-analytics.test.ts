/** income-analytics 收益记账聚合 / 筛选 / 导入导出单元测试（纯函数，无需 localStorage mock） */
import { describe, expect, it } from 'vitest'
import {
  aggregateIncomeByChannel,
  aggregateIncomeByMonth,
  exportIncomeCSV,
  exportIncomeJSON,
  filterIncomeByNotes,
  parseIncomeCSV,
  parseIncomeJSON,
} from '../income-analytics'
import type { IncomeRecord } from '../work-monetization'

/** 构造一条测试收入记录 */
function makeRecord(overrides: Partial<IncomeRecord> = {}): IncomeRecord {
  return {
    id: 'r1',
    workId: 'w1',
    workTitle: '测试作品',
    amount: 100,
    channel: 'wechat',
    date: new Date(2026, 0, 15).getTime(),
    note: '小说',
    ...overrides,
  }
}

describe('aggregateIncomeByChannel 按渠道聚合', () => {
  it('按渠道求和与笔数，并计算占比', () => {
    const records = [
      makeRecord({ id: '1', channel: 'wechat', amount: 100 }),
      makeRecord({ id: '2', channel: 'wechat', amount: 300 }),
      makeRecord({ id: '3', channel: 'alipay', amount: 400 }),
      makeRecord({ id: '4', channel: 'other', amount: 200 }),
    ]
    const agg = aggregateIncomeByChannel(records)
    expect(agg).toHaveLength(3)
    const wechat = agg.find(a => a.channel === 'wechat')!
    expect(wechat.total).toBe(400)
    expect(wechat.count).toBe(2)
    expect(wechat.label).toBe('微信')
    expect(wechat.percent).toBeCloseTo(40)
    const alipay = agg.find(a => a.channel === 'alipay')!
    expect(alipay.total).toBe(400)
    expect(alipay.percent).toBeCloseTo(40)
    const other = agg.find(a => a.channel === 'other')!
    expect(other.total).toBe(200)
    expect(other.percent).toBeCloseTo(20)
    // 按总额降序排列
    expect(agg[0].total).toBeGreaterThanOrEqual(agg[1].total)
    expect(agg[1].total).toBeGreaterThanOrEqual(agg[2].total)
  })

  it('占比之和约为 100%', () => {
    const records = [
      makeRecord({ id: '1', channel: 'wechat', amount: 123.45 }),
      makeRecord({ id: '2', channel: 'alipay', amount: 67.89 }),
      makeRecord({ id: '3', channel: 'third_party', amount: 200 }),
      makeRecord({ id: '4', channel: 'other', amount: 1 }),
    ]
    const agg = aggregateIncomeByChannel(records)
    const sum = agg.reduce((s, a) => s + a.percent, 0)
    expect(sum).toBeCloseTo(100, 1)
  })

  it('空记录返回空数组', () => {
    expect(aggregateIncomeByChannel([])).toEqual([])
  })

  it('金额缺失按 0 容错（NaN 视为 0）', () => {
    const records = [makeRecord({ id: 'x', amount: NaN })]
    const agg = aggregateIncomeByChannel(records)
    expect(agg[0].total).toBe(0)
    expect(agg[0].count).toBe(1)
    expect(agg[0].percent).toBe(0)
  })
})

describe('aggregateIncomeByMonth 按月度聚合', () => {
  it('按 YYYY-MM 分组求和与笔数（支持跨年）', () => {
    const records = [
      makeRecord({ id: '1', date: new Date(2025, 11, 5).getTime(), amount: 100 }),
      makeRecord({ id: '2', date: new Date(2025, 11, 20).getTime(), amount: 200 }),
      makeRecord({ id: '3', date: new Date(2026, 0, 10).getTime(), amount: 300 }),
      makeRecord({ id: '4', date: new Date(2026, 0, 25).getTime(), amount: 150 }),
      makeRecord({ id: '5', date: new Date(2026, 1, 15).getTime(), amount: 50 }),
    ]
    const agg = aggregateIncomeByMonth(records)
    expect(agg).toHaveLength(3)
    // 按月升序排列
    expect(agg.map(m => m.month)).toEqual(['2025-12', '2026-01', '2026-02'])
    expect(agg[0]).toEqual({ month: '2025-12', total: 300, count: 2 })
    expect(agg[1].total).toBe(450)
    expect(agg[1].count).toBe(2)
    expect(agg[2]).toEqual({ month: '2026-02', total: 50, count: 1 })
  })

  it('非法日期记录被忽略', () => {
    const records = [
      makeRecord({ id: '1', date: new Date(2026, 0, 1).getTime() }),
      makeRecord({ id: '2', date: NaN }),
    ]
    const agg = aggregateIncomeByMonth(records)
    expect(agg).toHaveLength(1)
    expect(agg[0].month).toBe('2026-01')
  })
})

describe('filterIncomeByNotes 备注筛选', () => {
  it('按备注包含查询词筛选（中文）', () => {
    const records = [
      makeRecord({ id: '1', note: '科幻小说《星海》' }),
      makeRecord({ id: '2', note: '爱情短篇' }),
      makeRecord({ id: '3', note: '科幻设定集' }),
    ]
    expect(filterIncomeByNotes(records, '科幻').map(r => r.id)).toEqual(['1', '3'])
  })

  it('英文备注大小写不敏感', () => {
    const records = [
      makeRecord({ id: '1', note: 'Patreon 订阅' }),
      makeRecord({ id: '2', note: 'patreon 打赏' }),
      makeRecord({ id: '3', note: '其他来源' }),
    ]
    expect(filterIncomeByNotes(records, 'PATREON').map(r => r.id)).toEqual(['1', '2'])
  })

  it('空查询返回全部记录', () => {
    const records = [makeRecord({ id: '1' }), makeRecord({ id: '2' })]
    expect(filterIncomeByNotes(records, '')).toHaveLength(2)
    expect(filterIncomeByNotes(records, '   ')).toHaveLength(2)
  })

  it('无备注的记录不会被匹配', () => {
    const records = [makeRecord({ id: '1', note: undefined })]
    expect(filterIncomeByNotes(records, 'x')).toHaveLength(0)
  })
})

describe('导出与导入', () => {
  it('CSV 导出包含表头且行数正确', () => {
    const records = [
      makeRecord({ id: 'r1', channel: 'wechat', amount: 100, date: 1736784000000, note: '小说《星海》' }),
      makeRecord({ id: 'r2', channel: 'alipay', amount: 50, date: 1736870400000, note: '短篇集' }),
    ]
    const csv = exportIncomeCSV(records)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('id,workId,workTitle,amount,channel,date,note')
    expect(lines).toHaveLength(3) // 表头 + 2 行数据
  })

  it('CSV 导出对含逗号/引号的备注进行转义并可往返', () => {
    const records = [makeRecord({ id: 'r1', note: '备注,含逗号"和引号"' })]
    const csv = exportIncomeCSV(records)
    const parsed = parseIncomeCSV(csv)
    expect(parsed.skipped).toBe(0)
    expect(parsed.records).toHaveLength(1)
    expect(parsed.records[0].note).toBe('备注,含逗号"和引号"')
    expect(parsed.records[0].amount).toBe(100)
  })

  it('JSON 导出与导入往返一致', () => {
    const records = [
      makeRecord({ id: 'r1', channel: 'wechat', amount: 100, note: '小说' }),
      makeRecord({ id: 'r2', channel: 'alipay', amount: 250.5, note: '短篇集' }),
    ]
    const json = exportIncomeJSON(records)
    const parsed = parseIncomeJSON(json)
    expect(parsed.skipped).toBe(0)
    expect(parsed.records).toEqual(records)
  })

  it('CSV 导出与导入往返一致（数值正确还原）', () => {
    const records = [
      makeRecord({ id: 'r1', channel: 'wechat', amount: 123.45, note: '订阅' }),
      makeRecord({ id: 'r2', channel: 'third_party', amount: 67.89, note: '打赏' }),
    ]
    const csv = exportIncomeCSV(records)
    const parsed = parseIncomeCSV(csv)
    expect(parsed.skipped).toBe(0)
    expect(parsed.records).toHaveLength(2)
    expect(parsed.records[0].amount).toBe(123.45)
    expect(parsed.records[0].channel).toBe('wechat')
    expect(parsed.records[1].channel).toBe('third_party')
  })
})

describe('导入容错（损坏数据跳过且不抛错）', () => {
  it('损坏 JSON 条目被跳过并计数，金额 NaN 按 0 容错', () => {
    const text = JSON.stringify([
      makeRecord({ id: 'ok' }),
      null,
      '字符串条目',
      { amount: 100 }, // 缺少 date → 损坏
      { date: 'not-a-date', amount: 100 }, // date 非法 → 损坏
      makeRecord({ id: 'nan', amount: NaN }), // 金额 NaN → 保留为 0
    ])
    const result = parseIncomeJSON(text)
    expect(result.skipped).toBe(4)
    expect(result.records).toHaveLength(2)
    expect(result.records[0].id).toBe('ok')
    expect(result.records[1].id).toBe('nan')
    expect(result.records[1].amount).toBe(0)
  })

  it('非法 JSON 文本返回空结果且不抛错', () => {
    const result = parseIncomeJSON('{ 这不是合法 JSON')
    expect(result.records).toEqual([])
    expect(result.skipped).toBe(0)
  })

  it('兼容 IncomeTracking 结构（{ records: [...] }）', () => {
    const text = JSON.stringify({ records: [makeRecord({ id: 'a' })], lastUpdated: 123 })
    const result = parseIncomeJSON(text)
    expect(result.skipped).toBe(0)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].id).toBe('a')
  })

  it('损坏 CSV 行被跳过并计数，不抛错', () => {
    const csv = [
      'id,workId,workTitle,amount,channel,date,note',
      'r1,w1,作品,100,wechat,1736784000000,正常',
      'r2,w1,作品,broken,alipay,1736870400000,金额非法', // 金额 NaN → 保留为 0
      'r3,w1,作品,50,wechat,not-a-date,日期非法', // date 非法 → 跳过
      '列数不足', // 列数不足 → 跳过
      '',
    ].join('\n')
    const result = parseIncomeCSV(csv)
    expect(result.skipped).toBe(2)
    expect(result.records).toHaveLength(2)
    expect(result.records[0].id).toBe('r1')
    expect(result.records[1].id).toBe('r2')
    expect(result.records[1].amount).toBe(0)
  })

  it('无表头或空 CSV 返回空结果', () => {
    expect(parseIncomeCSV('a,b,c').records).toEqual([])
    expect(parseIncomeCSV('').records).toEqual([])
  })
})

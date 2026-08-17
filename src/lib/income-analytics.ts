import type { IncomeRecord } from './work-monetization'

/**
 * 收益记录聚合 / 筛选 / 导入导出工具（纯函数）。
 * 仅处理本地手工记账数据，不接入任何支付流水或网络。
 */

/** 渠道显示名映射（与 income-panel 展示保持一致） */
export const CHANNEL_LABELS: Record<string, string> = {
  wechat: '微信',
  alipay: '支付宝',
  third_party: '第三方平台',
  stripe: 'Stripe',
  paypal: 'PayPal',
  afdian: '爱发电',
  mianbaoduo: '面包多',
  patreon: 'Patreon',
  'ko-fi': 'Ko-fi',
  other: '其他',
}

/** 合法的渠道 key（含面板中使用的 third_party） */
const VALID_CHANNELS = new Set(Object.keys(CHANNEL_LABELS))

/** CSV 列顺序（与记录结构一致） */
const CSV_COLUMNS = ['id', 'workId', 'workTitle', 'amount', 'channel', 'date', 'note'] as const

export interface ChannelAggregate {
  channel: string
  label: string
  total: number
  count: number
  /** 占比（0-100，两位小数） */
  percent: number
}

export interface MonthAggregate {
  /** 形如 2026-05 */
  month: string
  total: number
  count: number
}

/** 导入解析结果：records 为规范化后的记录数组，skipped 为跳过的损坏数据条数 */
export interface ParseResult {
  records: IncomeRecord[]
  skipped: number
}

/** 金额容错：缺失 / 非法数值一律视为 0 */
function safeAmount(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** 渠道容错：未知渠道回退为 other */
function normalizeChannel(value: unknown): IncomeRecord['channel'] {
  const ch = String(value ?? '').trim()
  if (VALID_CHANNELS.has(ch)) return ch as IncomeRecord['channel']
  return 'other'
}

/** 时间戳容错：支持数字时间戳或可解析的日期字符串，非法返回 NaN */
function toTimestamp(value: unknown): number {
  const n = Number(value)
  if (Number.isFinite(n)) return n
  if (typeof value === 'string' && value.trim()) {
    const t = Date.parse(value)
    if (Number.isFinite(t)) return t
  }
  return NaN
}

/**
 * 规范化单条导入记录：
 * - 非法日期视为损坏（返回 null，由调用方跳过并计数）；
 * - 金额缺失 / 非法按 0 容错（兼容旧数据）；
 * - id 缺失时自动生成，保证导入后可去重。
 */
function normalizeRecord(raw: unknown): IncomeRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const date = toTimestamp(obj.date)
  if (!Number.isFinite(date) || date <= 0) return null
  const record: IncomeRecord = {
    id:
      typeof obj.id === 'string' && obj.id
        ? obj.id
        : `income_import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    workId: typeof obj.workId === 'string' ? obj.workId : '',
    workTitle: typeof obj.workTitle === 'string' ? obj.workTitle : '',
    amount: safeAmount(obj.amount),
    channel: normalizeChannel(obj.channel),
    date,
    note: typeof obj.note === 'string' ? obj.note : '',
  }
  return record
}

/** 按渠道聚合：求和 + 笔数 + 占比，按总额降序排列 */
export function aggregateIncomeByChannel(records: IncomeRecord[]): ChannelAggregate[] {
  const map = new Map<string, { total: number; count: number }>()
  let grandTotal = 0
  for (const r of records) {
    const amount = safeAmount(r.amount)
    const channel = normalizeChannel(r.channel)
    const cur = map.get(channel) ?? { total: 0, count: 0 }
    cur.total += amount
    cur.count += 1
    map.set(channel, cur)
    grandTotal += amount
  }
  return Array.from(map.entries())
    .map(([channel, { total, count }]) => ({
      channel,
      label: CHANNEL_LABELS[channel] ?? '其他',
      total,
      count,
      percent: grandTotal > 0 ? Number(((total / grandTotal) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

/** 按月度聚合：按 YYYY-MM 分组求和与笔数，按月升序排列（支持跨年） */
export function aggregateIncomeByMonth(records: IncomeRecord[]): MonthAggregate[] {
  const map = new Map<string, { total: number; count: number }>()
  for (const r of records) {
    const d = new Date(r.date)
    if (Number.isNaN(d.getTime())) continue
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const cur = map.get(month) ?? { total: 0, count: 0 }
    cur.total += safeAmount(r.amount)
    cur.count += 1
    map.set(month, cur)
  }
  return Array.from(map.entries())
    .map(([month, { total, count }]) => ({ month, total, count }))
    .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0))
}

/** 备注筛选：备注包含查询词（大小写不敏感）；空查询返回全部记录 */
export function filterIncomeByNotes(records: IncomeRecord[], query: string): IncomeRecord[] {
  const q = query.trim().toLowerCase()
  if (!q) return records
  return records.filter(r => (r.note || '').toLowerCase().includes(q))
}

/** 导出为 JSON 字符串（可读格式） */
export function exportIncomeJSON(records: IncomeRecord[]): string {
  return JSON.stringify(records, null, 2)
}

/** CSV 字段转义：含逗号 / 引号 / 换行时用双引号包裹，内部引号翻倍 */
function csvEscape(value: string | number | undefined): string {
  const s = value === undefined ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** 导出为 CSV 字符串（带表头，字段与记录结构一致） */
export function exportIncomeCSV(records: IncomeRecord[]): string {
  const header = CSV_COLUMNS.join(',')
  const lines = records.map(r => CSV_COLUMNS.map(col => csvEscape(r[col])).join(','))
  return [header, ...lines].join('\n')
}

/** 简易 CSV 解析：支持引号包裹字段、转义引号与跨行字段 */
function parseCSVRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else {
      field += ch
    }
  }
  row.push(field)
  if (row.length > 0) rows.push(row)
  // 去掉完全空的行
  return rows.filter(r => !(r.length === 1 && r[0].trim() === ''))
}

/** 解析 JSON 导入文本（支持记录数组或 { records: [...] } 结构），损坏数据跳过并计数 */
export function parseIncomeJSON(text: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { records: [], skipped: 0 }
  }
  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { records?: unknown }).records)
      ? (data as { records: unknown[] }).records
      : null
  if (!list) return { records: [], skipped: 0 }
  const records: IncomeRecord[] = []
  let skipped = 0
  for (const item of list) {
    const r = normalizeRecord(item)
    if (r) records.push(r)
    else skipped += 1
  }
  return { records, skipped }
}

/** 解析 CSV 导入文本（首行为表头），损坏行跳过并计数；始终不抛错 */
export function parseIncomeCSV(text: string): ParseResult {
  const rows = parseCSVRows(text)
  if (rows.length < 2) return { records: [], skipped: 0 }
  const header = rows[0].map(h => h.trim().toLowerCase())
  // 建立列名 → 列下标
  const colIndex = new Map<string, number>()
  for (const col of CSV_COLUMNS) {
    const idx = header.indexOf(col.toLowerCase())
    if (idx >= 0) colIndex.set(col, idx)
  }
  const records: IncomeRecord[] = []
  let skipped = 0
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i]
    if (cells.length === 1 && cells[0].trim() === '') continue
    // 缺少金额 / 日期列说明表头不匹配，整表视为损坏
    if (colIndex.get('amount') === undefined || colIndex.get('date') === undefined) {
      skipped += 1
      continue
    }
    const raw: Record<string, unknown> = {}
    for (const col of CSV_COLUMNS) {
      const idx = colIndex.get(col)
      raw[col] = idx !== undefined ? cells[idx] : ''
    }
    const r = normalizeRecord(raw)
    if (r) records.push(r)
    else skipped += 1
  }
  return { records, skipped }
}

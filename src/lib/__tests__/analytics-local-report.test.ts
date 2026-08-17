import { beforeEach, describe, expect, it } from 'vitest'
import { AnalyticsStore } from '../analytics/analytics-store'
import { MemoryStorageAdapter } from '../storage/memory-storage-adapter'
import type { ChoiceEvent, NodeVisit, ReaderSession } from '../analytics/types'

const INDEX_KEY = 'analytics:index'
const SESSIONS_PREFIX = 'analytics:sessions:'
const VISITS_PREFIX = 'analytics:visits:'
const CHOICES_PREFIX = 'analytics:choices:'

/**
 * 直接向存储适配器注入 mock 数据，以便精确控制 dwellTime 等字段
 * （走 store 方法只能得到真实时间差，无法控制区间分档）
 */
async function seed(
  adapter: MemoryStorageAdapter,
  sessions: ReaderSession[],
  visits: NodeVisit[],
  choices: ChoiceEvent[] = []
): Promise<void> {
  for (const s of sessions) await adapter.set(`${SESSIONS_PREFIX}${s.id}`, s)
  for (const v of visits) await adapter.set(`${VISITS_PREFIX}${v.id}`, v)
  for (const c of choices) await adapter.set(`${CHOICES_PREFIX}${c.id}`, c)
  await adapter.set(INDEX_KEY, {
    sessions: sessions.map((s) => s.id),
    visits: visits.map((v) => v.id),
    choices: choices.map((c) => c.id),
  })
}

describe('AnalyticsStore 本地分析增强', () => {
  let adapter: MemoryStorageAdapter
  let store: AnalyticsStore

  beforeEach(() => {
    adapter = new MemoryStorageAdapter()
    store = new AnalyticsStore(adapter)
  })

  describe('读者流失点聚合', () => {
    it('能按每个会话最后一个访问节点统计流失点并按数量降序', async () => {
      // s1、s2 最后都停留在 n2，s3 停留在 n1
      const sessions: ReaderSession[] = [
        { id: 's1', storyId: 'story-1', startedAt: 1000, endedAt: 60000 },
        { id: 's2', storyId: 'story-1', startedAt: 2000, endedAt: 70000 },
        { id: 's3', storyId: 'story-1', startedAt: 3000, endedAt: 80000 },
      ]
      const visits: NodeVisit[] = [
        { id: 'v1', sessionId: 's1', storyId: 'story-1', nodeId: 'n1', nodeType: 'dialogue', enteredAt: 1000, exitedAt: 10000, dwellTime: 9000 },
        { id: 'v2', sessionId: 's1', storyId: 'story-1', nodeId: 'n2', nodeType: 'choice', enteredAt: 10000, exitedAt: 20000, dwellTime: 10000 },
        { id: 'v3', sessionId: 's2', storyId: 'story-1', nodeId: 'n1', nodeType: 'dialogue', enteredAt: 2000, exitedAt: 11000, dwellTime: 9000 },
        { id: 'v4', sessionId: 's2', storyId: 'story-1', nodeId: 'n2', nodeType: 'choice', enteredAt: 11000, exitedAt: 21000, dwellTime: 10000 },
        { id: 'v5', sessionId: 's3', storyId: 'story-1', nodeId: 'n1', nodeType: 'dialogue', enteredAt: 3000, exitedAt: 13000, dwellTime: 10000 },
      ]
      await seed(adapter, sessions, visits)

      const analytics = await store.getStoryAnalytics('story-1')

      expect(analytics.dropOffPoints).toEqual([
        { nodeId: 'n2', dropCount: 2 },
        { nodeId: 'n1', dropCount: 1 },
      ])
    })

    it('没有访问数据的会话不产生流失点', async () => {
      const sessions: ReaderSession[] = [
        { id: 's1', storyId: 'story-1', startedAt: 1000, endedAt: 60000 },
      ]
      await seed(adapter, sessions, [])

      const analytics = await store.getStoryAnalytics('story-1')

      expect(analytics.dropOffPoints).toEqual([])
    })
  })

  describe('节点停留分布聚合', () => {
    it('能按节点计算平均停留时长与访问数，并统计停留区间档位', async () => {
      // n1: 4 次访问（<10s / 10-30s / 30-60s / >60s 各一档）
      // n2: 2 次访问（均 <10s）
      // n3: 1 次访问但未结束（无 dwellTime，不计入停留统计）
      const sessions: ReaderSession[] = [
        { id: 's1', storyId: 'story-1', startedAt: 1000, endedAt: 60000 },
        { id: 's2', storyId: 'story-1', startedAt: 2000, endedAt: 70000 },
        { id: 's3', storyId: 'story-1', startedAt: 3000, endedAt: 80000 },
      ]
      const visits: NodeVisit[] = [
        { id: 'v1', sessionId: 's1', storyId: 'story-1', nodeId: 'n1', enteredAt: 1000, exitedAt: 6000, dwellTime: 5000 },
        { id: 'v2', sessionId: 's1', storyId: 'story-1', nodeId: 'n1', enteredAt: 10000, exitedAt: 25000, dwellTime: 15000 },
        { id: 'v3', sessionId: 's2', storyId: 'story-1', nodeId: 'n1', enteredAt: 2000, exitedAt: 47000, dwellTime: 45000 },
        { id: 'v4', sessionId: 's2', storyId: 'story-1', nodeId: 'n1', enteredAt: 50000, exitedAt: 170000, dwellTime: 120000 },
        { id: 'v5', sessionId: 's3', storyId: 'story-1', nodeId: 'n2', enteredAt: 3000, exitedAt: 5000, dwellTime: 2000 },
        { id: 'v6', sessionId: 's3', storyId: 'story-1', nodeId: 'n2', enteredAt: 10000, exitedAt: 18000, dwellTime: 8000 },
        { id: 'v7', sessionId: 's3', storyId: 'story-1', nodeId: 'n3', enteredAt: 20000 },
      ]
      await seed(adapter, sessions, visits)

      const analytics = await store.getStoryAnalytics('story-1')

      // 每节点平均停留与访问数
      const n1 = analytics.nodeDwellStats.find((d) => d.nodeId === 'n1')
      expect(n1?.avgDwellMs).toBe(Math.round((5000 + 15000 + 45000 + 120000) / 4)) // 46250
      expect(n1?.visitCount).toBe(4)

      const n2 = analytics.nodeDwellStats.find((d) => d.nodeId === 'n2')
      expect(n2?.avgDwellMs).toBe(5000)
      expect(n2?.visitCount).toBe(2)

      // 无 dwellTime 的访问不计入
      expect(analytics.nodeDwellStats.find((d) => d.nodeId === 'n3')).toBeUndefined()

      // 全局停留区间分布（固定四档顺序）
      expect(analytics.dwellDistribution).toEqual([
        { label: '<10s', count: 3 }, // 5000 / 2000 / 8000
        { label: '10-30s', count: 1 }, // 15000
        { label: '30-60s', count: 1 }, // 45000
        { label: '>60s', count: 1 }, // 120000
      ])
    })

    it('没有停留数据时区间分布全部为零', async () => {
      const sessions: ReaderSession[] = [{ id: 's1', storyId: 'story-1', startedAt: 1000, endedAt: 60000 }]
      await seed(adapter, sessions, [])

      const analytics = await store.getStoryAnalytics('story-1')

      expect(analytics.nodeDwellStats).toEqual([])
      expect(analytics.dwellDistribution).toEqual([
        { label: '<10s', count: 0 },
        { label: '10-30s', count: 0 },
        { label: '30-60s', count: 0 },
        { label: '>60s', count: 0 },
      ])
    })
  })

  describe('导出分析报告', () => {
    const sessions: ReaderSession[] = [
      { id: 's1', storyId: 'story-1', startedAt: 1000, endedAt: 60000 },
      { id: 's2', storyId: 'story-1', startedAt: 2000, endedAt: 70000 },
    ]
    const visits: NodeVisit[] = [
      { id: 'v1', sessionId: 's1', storyId: 'story-1', nodeId: 'n1', nodeType: 'dialogue', enteredAt: 1000, exitedAt: 6000, dwellTime: 5000 },
      { id: 'v2', sessionId: 's1', storyId: 'story-1', nodeId: 'n2', nodeType: 'choice', enteredAt: 10000, exitedAt: 25000, dwellTime: 15000 },
      { id: 'v3', sessionId: 's2', storyId: 'story-1', nodeId: 'n1', nodeType: 'dialogue', enteredAt: 2000, exitedAt: 4000, dwellTime: 2000 },
      { id: 'v4', sessionId: 's2', storyId: 'story-1', nodeId: 'n2', nodeType: 'choice', enteredAt: 10000, exitedAt: 18000, dwellTime: 8000 },
    ]

    it('导出的 JSON 包含完整聚合字段', async () => {
      await seed(adapter, sessions, visits)

      const json = await store.exportAnalyticsJson('story-1')
      const parsed = JSON.parse(json)

      expect(parsed.storyId).toBe('story-1')
      expect(parsed.totalSessions).toBe(2)
      expect(parsed.dropOffPoints).toEqual([{ nodeId: 'n2', dropCount: 2 }])
      expect(parsed.nodeDwellStats).toContainEqual({ nodeId: 'n1', avgDwellMs: 3500, visitCount: 2 })
      expect(parsed.dwellDistribution).toHaveLength(4)
      expect(parsed.dwellDistribution.find((b: { label: string }) => b.label === '<10s')?.count).toBe(3)
      // 保持向后兼容：原有字段仍在
      expect(parsed.nodeVisits).toBeDefined()
      expect(parsed.choiceDistribution).toBeDefined()
    })

    it('导出的 CSV 包含节点级数据表头与数据行', async () => {
      await seed(adapter, sessions, visits)

      const csv = await store.exportAnalyticsCsv('story-1')
      const lines = csv.split('\n')

      // 表头
      expect(lines[0]).toBe('nodeId,nodeType,visitCount,averageDwellMs,uniqueVisitors,dropCount')
      // 数据行：n1（访问 2 次，平均停留 3500ms，流失 0 次）、n2（访问 2 次，平均停留 11500ms，流失 2 次）
      expect(lines).toContain('n1,dialogue,2,3500,2,0')
      expect(lines).toContain('n2,choice,2,11500,2,2')
    })

    it('CSV 能转义含逗号的节点 id', async () => {
      const withComma: ReaderSession[] = [{ id: 's1', storyId: 'story-1', startedAt: 1000, endedAt: 60000 }]
      const withCommaVisits: NodeVisit[] = [
        { id: 'v1', sessionId: 's1', storyId: 'story-1', nodeId: 'a,b', enteredAt: 1000, exitedAt: 6000, dwellTime: 5000 },
      ]
      await seed(adapter, withComma, withCommaVisits)

      const csv = await store.exportAnalyticsCsv('story-1')
      expect(csv).toContain('"a,b",,1,5000,1,1')
    })
  })
})

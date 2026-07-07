import { describe, it, expect, beforeEach } from 'vitest'
import { AnalyticsStore } from '../analytics/analytics-store'

describe('AnalyticsStore', () => {
  let store: AnalyticsStore

  beforeEach(() => {
    store = new AnalyticsStore()
  })

  describe('session', () => {
    it('能创建会话', async () => {
      const session = await store.startSession('story-1')

      expect(session.id).toBeDefined()
      expect(session.storyId).toBe('story-1')
      expect(session.startedAt).toBeGreaterThan(0)
      expect(session.endedAt).toBeUndefined()
    })

    it('能结束会话', async () => {
      const session = await store.startSession('story-1')
      await store.endSession(session.id)

      const saved = await store.getSession(session.id)
      expect(saved?.endedAt).toBeDefined()
    })

    it('能按 storyId 过滤会话', async () => {
      await store.startSession('story-1')
      await store.startSession('story-2')
      await store.startSession('story-1')

      const sessions = await store.getSessions({ storyId: 'story-1' })
      expect(sessions).toHaveLength(2)
    })

    it('结束不存在的会话不报错', async () => {
      await expect(store.endSession('nonexistent')).resolves.not.toThrow()
    })
  })

  describe('node visits', () => {
    it('能记录节点访问', async () => {
      const session = await store.startSession('story-1')
      const visit = await store.recordNodeVisit(
        session.id,
        'story-1',
        'node-1',
        'dialogue'
      )

      expect(visit.nodeId).toBe('node-1')
      expect(visit.nodeType).toBe('dialogue')
      expect(visit.enteredAt).toBeGreaterThan(0)
    })

    it('能结束节点访问并计算停留时间', async () => {
      const session = await store.startSession('story-1')
      const visit = await store.recordNodeVisit(session.id, 'story-1', 'node-1')

      await new Promise((r) => setTimeout(r, 10))
      await store.endNodeVisit(visit.id)

      const visits = await store.getNodeVisits()
      expect(visits[0].dwellTime).toBeGreaterThanOrEqual(0)
      expect(visits[0].exitedAt).toBeDefined()
    })

    it('能按节点类型过滤', async () => {
      const session = await store.startSession('story-1')
      await store.recordNodeVisit(session.id, 'story-1', 'n1', 'dialogue')
      await store.recordNodeVisit(session.id, 'story-1', 'n2', 'choice')

      const dialogueVisits = await store.getNodeVisits({ nodeType: 'dialogue' })
      expect(dialogueVisits).toHaveLength(1)
      expect(dialogueVisits[0].nodeId).toBe('n1')
    })
  })

  describe('choices', () => {
    it('能记录选择事件', async () => {
      const session = await store.startSession('story-1')
      const choice = await store.recordChoice(
        session.id,
        'story-1',
        'node-1',
        '选择A',
        0,
        'node-2'
      )

      expect(choice.choiceText).toBe('选择A')
      expect(choice.choiceIndex).toBe(0)
      expect(choice.nextNodeId).toBe('node-2')
    })

    it('能按会话过滤', async () => {
      const s1 = await store.startSession('story-1')
      const s2 = await store.startSession('story-1')

      await store.recordChoice(s1.id, 'story-1', 'n1', 'A', 0)
      await store.recordChoice(s2.id, 'story-1', 'n1', 'B', 1)

      const choices = await store.getChoices({ sessionId: s1.id })
      expect(choices).toHaveLength(1)
      expect(choices[0].choiceText).toBe('A')
    })
  })

  describe('getStoryAnalytics', () => {
    it('能聚合故事分析数据', async () => {
      const s1 = await store.startSession('story-1')
      const s2 = await store.startSession('story-1')
      await store.endSession(s1.id)

      const v1 = await store.recordNodeVisit(s1.id, 'story-1', 'node-1', 'dialogue')
      await store.endNodeVisit(v1.id)
      const v2 = await store.recordNodeVisit(s2.id, 'story-1', 'node-1', 'dialogue')
      await store.endNodeVisit(v2.id)
      await store.recordNodeVisit(s1.id, 'story-1', 'node-2', 'ending')

      await store.recordChoice(s1.id, 'story-1', 'node-1', '选A', 0, 'node-2')
      await store.recordChoice(s2.id, 'story-1', 'node-1', '选A', 0, 'node-2')
      await store.recordChoice(s2.id, 'story-1', 'node-1', '选B', 1, 'node-3')

      const analytics = await store.getStoryAnalytics('story-1')

      expect(analytics.storyId).toBe('story-1')
      expect(analytics.totalSessions).toBe(2)
      expect(analytics.completionRate).toBe(0.5)
      expect(analytics.nodeVisits).toHaveLength(2)

      const node1Stat = analytics.nodeVisits.find((v) => v.nodeId === 'node-1')
      expect(node1Stat?.visitCount).toBe(2)

      const choiceA = analytics.choiceDistribution.find(
        (c) => c.choiceText === '选A'
      )
      expect(choiceA?.selectionCount).toBe(2)
      expect(choiceA?.percentage).toBeCloseTo(66.67, 1)
    })

    it('没有数据时返回零值', async () => {
      const analytics = await store.getStoryAnalytics('empty-story')

      expect(analytics.totalSessions).toBe(0)
      expect(analytics.uniqueReaders).toBe(0)
      expect(analytics.averageDwellTime).toBe(0)
      expect(analytics.completionRate).toBe(0)
      expect(analytics.nodeVisits).toEqual([])
    })
  })

  describe('clearStory', () => {
    it('能清除指定故事的所有数据', async () => {
      const session = await store.startSession('story-1')
      await store.recordNodeVisit(session.id, 'story-1', 'n1')
      await store.recordChoice(session.id, 'story-1', 'n1', 'A', 0)

      await store.clearStory('story-1')

      const sessions = await store.getSessions({ storyId: 'story-1' })
      const visits = await store.getNodeVisits({ storyId: 'story-1' })
      const choices = await store.getChoices({ storyId: 'story-1' })

      expect(sessions).toHaveLength(0)
      expect(visits).toHaveLength(0)
      expect(choices).toHaveLength(0)
    })
  })

  describe('clearAll', () => {
    it('能清除所有分析数据', async () => {
      await store.startSession('story-1')
      await store.startSession('story-2')

      await store.clearAll()

      const all = await store.getSessions()
      expect(all).toHaveLength(0)
    })
  })
})

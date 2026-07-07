import type { StorageAdapter } from '../storage/types'
import { MemoryStorageAdapter } from '../storage/memory-storage-adapter'
import type {
  ReaderSession,
  NodeVisit,
  ChoiceEvent,
  StoryAnalytics,
  NodeVisitStat,
  ChoiceStat,
  AnalyticsFilter,
} from './types'

const SESSIONS_PREFIX = 'analytics:sessions:'
const VISITS_PREFIX = 'analytics:visits:'
const CHOICES_PREFIX = 'analytics:choices:'
const INDEX_KEY = 'analytics:index'

export class AnalyticsStore {
  private storage: StorageAdapter

  constructor(storage?: StorageAdapter) {
    this.storage = storage || new MemoryStorageAdapter()
  }

  async startSession(storyId: string, deviceInfo?: ReaderSession['deviceInfo']): Promise<ReaderSession> {
    const session: ReaderSession = {
      id: generateId('session'),
      storyId,
      startedAt: Date.now(),
      deviceInfo,
    }

    await this.storage.set(`${SESSIONS_PREFIX}${session.id}`, session)
    await this.addToIndex('sessions', session.id)
    return session
  }

  async endSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId)
    if (!session) return

    session.endedAt = Date.now()
    await this.storage.set(`${SESSIONS_PREFIX}${sessionId}`, session)
  }

  async getSession(sessionId: string): Promise<ReaderSession | null> {
    return this.storage.get<ReaderSession>(`${SESSIONS_PREFIX}${sessionId}`)
  }

  async getSessions(filter?: AnalyticsFilter): Promise<ReaderSession[]> {
    const ids = await this.getIndex('sessions')
    const sessions: ReaderSession[] = []

    for (const id of ids) {
      const session = await this.storage.get<ReaderSession>(`${SESSIONS_PREFIX}${id}`)
      if (!session) continue

      if (filter?.storyId && session.storyId !== filter.storyId) continue
      if (filter?.sessionId && session.id !== filter.sessionId) continue
      if (filter?.startTime && session.startedAt < filter.startTime) continue
      if (filter?.endTime && session.startedAt > filter.endTime) continue

      sessions.push(session)
    }

    return sessions.sort((a, b) => a.startedAt - b.startedAt)
  }

  async recordNodeVisit(
    sessionId: string,
    storyId: string,
    nodeId: string,
    nodeType?: string,
    choices?: string[]
  ): Promise<NodeVisit> {
    const visit: NodeVisit = {
      id: generateId('visit'),
      sessionId,
      storyId,
      nodeId,
      nodeType,
      enteredAt: Date.now(),
      choices,
    }

    await this.storage.set(`${VISITS_PREFIX}${visit.id}`, visit)
    await this.addToIndex('visits', visit.id)
    return visit
  }

  async endNodeVisit(visitId: string): Promise<void> {
    const visit = await this.storage.get<NodeVisit>(`${VISITS_PREFIX}${visitId}`)
    if (!visit) return

    visit.exitedAt = Date.now()
    visit.dwellTime = visit.exitedAt - visit.enteredAt
    await this.storage.set(`${VISITS_PREFIX}${visitId}`, visit)
  }

  async getNodeVisits(filter?: AnalyticsFilter): Promise<NodeVisit[]> {
    const ids = await this.getIndex('visits')
    const visits: NodeVisit[] = []

    for (const id of ids) {
      const visit = await this.storage.get<NodeVisit>(`${VISITS_PREFIX}${id}`)
      if (!visit) continue

      if (filter?.storyId && visit.storyId !== filter.storyId) continue
      if (filter?.sessionId && visit.sessionId !== filter.sessionId) continue
      if (filter?.startTime && visit.enteredAt < filter.startTime) continue
      if (filter?.endTime && visit.enteredAt > filter.endTime) continue
      if (filter?.nodeType && visit.nodeType !== filter.nodeType) continue

      visits.push(visit)
    }

    return visits.sort((a, b) => a.enteredAt - b.enteredAt)
  }

  async recordChoice(
    sessionId: string,
    storyId: string,
    nodeId: string,
    choiceText: string,
    choiceIndex: number,
    nextNodeId?: string
  ): Promise<ChoiceEvent> {
    const event: ChoiceEvent = {
      id: generateId('choice'),
      sessionId,
      storyId,
      nodeId,
      choiceText,
      choiceIndex,
      selectedAt: Date.now(),
      nextNodeId,
    }

    await this.storage.set(`${CHOICES_PREFIX}${event.id}`, event)
    await this.addToIndex('choices', event.id)
    return event
  }

  async getChoices(filter?: AnalyticsFilter): Promise<ChoiceEvent[]> {
    const ids = await this.getIndex('choices')
    const choices: ChoiceEvent[] = []

    for (const id of ids) {
      const event = await this.storage.get<ChoiceEvent>(`${CHOICES_PREFIX}${id}`)
      if (!event) continue

      if (filter?.storyId && event.storyId !== filter.storyId) continue
      if (filter?.sessionId && event.sessionId !== filter.sessionId) continue
      if (filter?.startTime && event.selectedAt < filter.startTime) continue
      if (filter?.endTime && event.selectedAt > filter.endTime) continue

      choices.push(event)
    }

    return choices.sort((a, b) => a.selectedAt - b.selectedAt)
  }

  async getStoryAnalytics(storyId: string): Promise<StoryAnalytics> {
    const [sessions, visits, choices] = await Promise.all([
      this.getSessions({ storyId }),
      this.getNodeVisits({ storyId }),
      this.getChoices({ storyId }),
    ])

    const uniqueReaderIds = new Set(sessions.map((s) => s.id))
    const totalDwellTime = visits.reduce((sum, v) => sum + (v.dwellTime || 0), 0)
    const completedSessions = sessions.filter((s) => s.endedAt).length

    const nodeVisitMap = new Map<string, NodeVisitStat>()
    for (const visit of visits) {
      const stat = nodeVisitMap.get(visit.nodeId) || {
        nodeId: visit.nodeId,
        nodeType: visit.nodeType,
        visitCount: 0,
        averageDwellTime: 0,
        uniqueVisitors: 0,
      }

      stat.visitCount++
      const uniqueVisitors = nodeVisitMap.get(visit.nodeId)?.uniqueVisitors || 0
      stat.uniqueVisitors = uniqueVisitors + 1

      const totalDwell = (nodeVisitMap.get(visit.nodeId)?.averageDwellTime || 0) * (stat.visitCount - 1)
      stat.averageDwellTime = (totalDwell + (visit.dwellTime || 0)) / stat.visitCount

      nodeVisitMap.set(visit.nodeId, stat)
    }

    const choiceMap = new Map<string, ChoiceStat>()
    for (const choice of choices) {
      const key = `${choice.nodeId}:${choice.choiceIndex}`
      const stat = choiceMap.get(key) || {
        nodeId: choice.nodeId,
        choiceText: choice.choiceText,
        choiceIndex: choice.choiceIndex,
        selectionCount: 0,
        percentage: 0,
      }

      stat.selectionCount++
      choiceMap.set(key, stat)
    }

    const nodeChoices = new Map<string, number>()
    for (const choice of choices) {
      const count = nodeChoices.get(choice.nodeId) || 0
      nodeChoices.set(choice.nodeId, count + 1)
    }

    const choiceDistribution: ChoiceStat[] = []
    for (const stat of choiceMap.values()) {
      const total = nodeChoices.get(stat.nodeId) || 1
      stat.percentage = (stat.selectionCount / total) * 100
      choiceDistribution.push(stat)
    }

    return {
      storyId,
      totalSessions: sessions.length,
      uniqueReaders: uniqueReaderIds.size,
      averageDwellTime: sessions.length > 0 ? totalDwellTime / sessions.length : 0,
      completionRate: sessions.length > 0 ? completedSessions / sessions.length : 0,
      nodeVisits: Array.from(nodeVisitMap.values()).sort((a, b) => b.visitCount - a.visitCount),
      choiceDistribution: choiceDistribution.sort((a, b) => b.selectionCount - a.selectionCount),
    }
  }

  async clearStory(storyId: string): Promise<void> {
    const [sessions, visits, choices] = await Promise.all([
      this.getSessions({ storyId }),
      this.getNodeVisits({ storyId }),
      this.getChoices({ storyId }),
    ])

    for (const s of sessions) {
      await this.storage.remove(`${SESSIONS_PREFIX}${s.id}`)
      await this.removeFromIndex('sessions', s.id)
    }
    for (const v of visits) {
      await this.storage.remove(`${VISITS_PREFIX}${v.id}`)
      await this.removeFromIndex('visits', v.id)
    }
    for (const c of choices) {
      await this.storage.remove(`${CHOICES_PREFIX}${c.id}`)
      await this.removeFromIndex('choices', c.id)
    }
  }

  async clearAll(): Promise<void> {
    const allKeys = await this.storage.keys('analytics:')
    for (const key of allKeys) {
      await this.storage.remove(key)
    }
  }

  private async getIndex(name: string): Promise<string[]> {
    const index = await this.storage.get<Record<string, string[]>>(INDEX_KEY)
    return index?.[name] || []
  }

  private async addToIndex(name: string, id: string): Promise<void> {
    const index = (await this.storage.get<Record<string, string[]>>(INDEX_KEY)) || {}
    if (!index[name]) index[name] = []
    if (!index[name].includes(id)) {
      index[name].push(id)
      await this.storage.set(INDEX_KEY, index)
    }
  }

  private async removeFromIndex(name: string, id: string): Promise<void> {
    const index = (await this.storage.get<Record<string, string[]>>(INDEX_KEY)) || {}
    if (index[name]) {
      index[name] = index[name].filter((x) => x !== id)
      await this.storage.set(INDEX_KEY, index)
    }
  }
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export const analyticsStore = new AnalyticsStore()

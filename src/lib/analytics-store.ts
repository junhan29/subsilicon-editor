export interface ReaderAction {
  id: string
  type: 'start' | 'end' | 'nodeEnter' | 'nodeLeave' | 'choice' | 'variableChange' | 'ending' | 'restart'
  nodeId?: string
  nodeType?: string
  choiceOptionId?: string
  choiceOptionText?: string
  variableName?: string
  variableValue?: string | number | boolean
  endingType?: 'good' | 'bad' | 'neutral' | 'secret'
  timestamp: number
  duration?: number
}

export interface ReaderSession {
  id: string
  storyId: string
  startTime: number
  endTime?: number
  duration?: number
  actions: ReaderAction[]
  visitedNodes: string[]
  completed: boolean
  endingReached?: string
  endingType?: 'good' | 'bad' | 'neutral' | 'secret'
}

export interface StoryAnalytics {
  storyId: string
  totalSessions: number
  averageDuration: number
  completionRate: number
  nodeVisits: Record<string, number>
  choiceDistribution: Record<string, Record<string, number>>
  endingDistribution: Record<string, number>
  peakHours: number[]
  lastUpdate: number
}

const ANALYTICS_KEY_PREFIX = 'subsilicon_analytics_'
const SESSION_KEY = 'subsilicon_current_session'

export function startSession(storyId: string): ReaderSession {
  const session: ReaderSession = {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    storyId,
    startTime: Date.now(),
    actions: [],
    visitedNodes: [],
    completed: false,
  }
  
  session.actions.push({
    id: `action-${Date.now()}`,
    type: 'start',
    timestamp: Date.now(),
  })
  
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function recordAction(action: Omit<ReaderAction, 'id' | 'timestamp'>): void {
  try {
    const sessionStr = localStorage.getItem(SESSION_KEY)
    if (!sessionStr) return
    
    const session = JSON.parse(sessionStr) as ReaderSession
    const newAction: ReaderAction = {
      ...action,
      id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    }
    
    session.actions.push(newAction)
    
    if (action.type === 'nodeEnter' && action.nodeId) {
      if (!session.visitedNodes.includes(action.nodeId)) {
        session.visitedNodes.push(action.nodeId)
      }
    }
    
    if (action.type === 'ending') {
      session.completed = true
      session.endingReached = action.nodeId
      session.endingType = action.endingType
    }
    
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    console.warn('Failed to record analytics action')
  }
}

export function endSession(): ReaderSession | null {
  try {
    const sessionStr = localStorage.getItem(SESSION_KEY)
    if (!sessionStr) return null
    
    const session = JSON.parse(sessionStr) as ReaderSession
    session.endTime = Date.now()
    session.duration = session.endTime - session.startTime
    
    session.actions.push({
      id: `action-${Date.now()}`,
      type: 'end',
      timestamp: Date.now(),
      duration: session.duration,
    })
    
    localStorage.removeItem(SESSION_KEY)
    
    saveSession(session)
    updateStoryAnalytics(session)
    
    return session
  } catch {
    console.warn('Failed to end analytics session')
    return null
  }
}

export function saveSession(session: ReaderSession): void {
  try {
    const key = `${ANALYTICS_KEY_PREFIX}sessions_${session.storyId}`
    const existingStr = localStorage.getItem(key)
    const sessions: ReaderSession[] = existingStr ? JSON.parse(existingStr) : []
    
    sessions.push(session)
    
    if (sessions.length > 100) {
      sessions.shift()
    }
    
    localStorage.setItem(key, JSON.stringify(sessions))
  } catch {
    console.warn('Failed to save session')
  }
}

export function getSessions(storyId: string): ReaderSession[] {
  try {
    const key = `${ANALYTICS_KEY_PREFIX}sessions_${storyId}`
    const existingStr = localStorage.getItem(key)
    return existingStr ? JSON.parse(existingStr) : []
  } catch {
    return []
  }
}

export function updateStoryAnalytics(session: ReaderSession): void {
  try {
    const key = `${ANALYTICS_KEY_PREFIX}story_${session.storyId}`
    const existingStr = localStorage.getItem(key)
    let analytics: StoryAnalytics = existingStr 
      ? JSON.parse(existingStr) 
      : createEmptyAnalytics(session.storyId)
    
    analytics.totalSessions += 1
    
    if (session.duration) {
      analytics.averageDuration = Math.round(
        (analytics.averageDuration * (analytics.totalSessions - 1) + session.duration) /
        analytics.totalSessions
      )
    }
    
    if (session.completed) {
      const completedCount = Math.round(analytics.completionRate * analytics.totalSessions) + 1
      analytics.completionRate = completedCount / analytics.totalSessions
    }
    
    session.visitedNodes.forEach((nodeId) => {
      analytics.nodeVisits[nodeId] = (analytics.nodeVisits[nodeId] || 0) + 1
    })
    
    session.actions.forEach((action) => {
      if (action.type === 'choice' && action.nodeId && action.choiceOptionId) {
        if (!analytics.choiceDistribution[action.nodeId]) {
          analytics.choiceDistribution[action.nodeId] = {}
        }
        const optionId = action.choiceOptionId || action.choiceOptionText || 'unknown'
        analytics.choiceDistribution[action.nodeId][optionId] =
          (analytics.choiceDistribution[action.nodeId][optionId] || 0) + 1
      }
      
      if (action.type === 'ending' && action.endingType) {
        analytics.endingDistribution[action.endingType] =
          (analytics.endingDistribution[action.endingType] || 0) + 1
      }
    })
    
    const hour = new Date(session.startTime).getHours()
    analytics.peakHours[hour] = (analytics.peakHours[hour] || 0) + 1
    
    analytics.lastUpdate = Date.now()
    
    localStorage.setItem(key, JSON.stringify(analytics))
  } catch {
    console.warn('Failed to update story analytics')
  }
}

export function getStoryAnalytics(storyId: string): StoryAnalytics {
  try {
    const key = `${ANALYTICS_KEY_PREFIX}story_${storyId}`
    const existingStr = localStorage.getItem(key)
    return existingStr ? JSON.parse(existingStr) : createEmptyAnalytics(storyId)
  } catch {
    return createEmptyAnalytics(storyId)
  }
}

function createEmptyAnalytics(storyId: string): StoryAnalytics {
  return {
    storyId,
    totalSessions: 0,
    averageDuration: 0,
    completionRate: 0,
    nodeVisits: {},
    choiceDistribution: {},
    endingDistribution: {},
    peakHours: new Array(24).fill(0),
    lastUpdate: Date.now(),
  }
}

export function clearAnalytics(storyId?: string): void {
  try {
    if (storyId) {
      localStorage.removeItem(`${ANALYTICS_KEY_PREFIX}sessions_${storyId}`)
      localStorage.removeItem(`${ANALYTICS_KEY_PREFIX}story_${storyId}`)
    } else {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(ANALYTICS_KEY_PREFIX))
      keys.forEach((k) => localStorage.removeItem(k))
      localStorage.removeItem(SESSION_KEY)
    }
  } catch {
    console.warn('Failed to clear analytics')
  }
}

export function exportAnalytics(storyId: string): string {
  try {
    const analytics = getStoryAnalytics(storyId)
    const sessions = getSessions(storyId)
    return JSON.stringify({ analytics, sessions }, null, 2)
  } catch {
    return '{}'
  }
}

export interface AnalyticsInsight {
  type: 'popular' | 'unpopular' | 'completion' | 'choice' | 'timing'
  message: string
  severity: 'info' | 'warning' | 'success'
  data?: Record<string, unknown>
}

export function generateInsights(analytics: StoryAnalytics, nodeCount: number): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = []
  
  if (analytics.completionRate < 0.5) {
    insights.push({
      type: 'completion',
      message: `完成率较低（${Math.round(analytics.completionRate * 100)}%），可能需要优化故事流程或减少分支复杂度`,
      severity: 'warning',
      data: { completionRate: analytics.completionRate },
    })
  }
  
  if (analytics.completionRate >= 0.8) {
    insights.push({
      type: 'completion',
      message: `完成率很高（${Math.round(analytics.completionRate * 100)}%），故事设计很吸引人！`,
      severity: 'success',
      data: { completionRate: analytics.completionRate },
    })
  }
  
  const visitCounts = Object.values(analytics.nodeVisits)
  if (visitCounts.length > 0) {
    const avgVisits = visitCounts.reduce((a, b) => a + b, 0) / visitCounts.length
    const minVisits = Math.min(...visitCounts)
    
    if (minVisits < avgVisits * 0.3) {
      insights.push({
        type: 'unpopular',
        message: '部分节点访问量明显偏低，可能存在分支路径过于隐蔽或内容不够吸引人',
        severity: 'warning',
        data: { avgVisits, minVisits },
      })
    }
  }
  
  for (const [nodeId, choices] of Object.entries(analytics.choiceDistribution)) {
    const total = Object.values(choices).reduce((a, b) => a + b, 0)
    if (total > 10) {
      for (const [option, count] of Object.entries(choices)) {
        const percentage = (count / total) * 100
        if (percentage > 80) {
          insights.push({
            type: 'choice',
            message: `节点 ${nodeId} 的选项 "${option}" 被选择率高达 ${Math.round(percentage)}%，其他选项可能缺乏吸引力`,
            severity: 'info',
            data: { nodeId, option, percentage },
          })
        }
      }
    }
  }
  
  const maxHour = analytics.peakHours.indexOf(Math.max(...analytics.peakHours))
  if (analytics.totalSessions > 5) {
    insights.push({
      type: 'timing',
      message: `读者访问高峰时段是 ${maxHour}:00 - ${maxHour + 1}:00`,
      severity: 'info',
      data: { peakHour: maxHour },
    })
  }
  
  return insights
}

export interface ReaderSession {
  id: string
  storyId: string
  startedAt: number
  endedAt?: number
  deviceInfo?: {
    platform?: string
    screenWidth?: number
    screenHeight?: number
    language?: string
  }
}

export interface NodeVisit {
  id: string
  sessionId: string
  storyId: string
  nodeId: string
  nodeType?: string
  enteredAt: number
  exitedAt?: number
  dwellTime?: number
  choices?: string[]
}

export interface ChoiceEvent {
  id: string
  sessionId: string
  storyId: string
  nodeId: string
  choiceText: string
  choiceIndex: number
  selectedAt: number
  nextNodeId?: string
}

export interface StoryAnalytics {
  storyId: string
  totalSessions: number
  uniqueReaders: number
  averageDwellTime: number
  completionRate: number
  nodeVisits: NodeVisitStat[]
  choiceDistribution: ChoiceStat[]
}

export interface NodeVisitStat {
  nodeId: string
  nodeType?: string
  visitCount: number
  averageDwellTime: number
  uniqueVisitors: number
}

export interface ChoiceStat {
  nodeId: string
  choiceText: string
  choiceIndex: number
  selectionCount: number
  percentage: number
}

export interface AnalyticsFilter {
  storyId?: string
  sessionId?: string
  startTime?: number
  endTime?: number
  nodeType?: string
}

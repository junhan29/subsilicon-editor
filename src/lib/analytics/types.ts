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
  /** 读者流失点：读者在哪个节点后离开会话（最后访问节点分布），按数量降序 */
  dropOffPoints: DropOffStat[]
  /** 节点停留分布：每个节点的平均停留时长与访问数 */
  nodeDwellStats: NodeDwellStat[]
  /** 全局停留时长区间分布（<10s / 10-30s / 30-60s / >60s） */
  dwellDistribution: DwellBucketStat[]
}

/** 读者流失点统计：在 nodeId 节点后离开（退出会话）的会话数 */
export interface DropOffStat {
  nodeId: string
  dropCount: number
}

/** 停留时长区间标签 */
export type DwellBucketLabel = '<10s' | '10-30s' | '30-60s' | '>60s'

/** 停留时长区间计数 */
export interface DwellBucketStat {
  label: DwellBucketLabel
  count: number
}

/** 节点停留分布统计 */
export interface NodeDwellStat {
  nodeId: string
  /** 平均停留时长（毫秒），仅基于有 dwellTime 的访问 */
  avgDwellMs: number
  /** 计入平均停留的有效访问数 */
  visitCount: number
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

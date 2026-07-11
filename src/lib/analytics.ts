export interface StoryAnalytics {
  totalReaders: number
  completionRate: number
  averageReadTime: number
  averageDwellTime: number
  lastUpdated: number
  totalSessions: number
  uniqueReaders: number
  totalTime: number
  completionCount: number
  nodeVisits: NodeVisitStat[]
  choices: ChoiceStat[]
  choiceDistribution: ChoiceStat[]
  [key: string]: any
}

export interface NodeVisitStat {
  nodeId: string
  visitCount: number
  nodeType: string
  totalTime: number
  exits: number
  [key: string]: any
}

export interface ChoiceStat {
  sourceNodeId: string
  choiceIndex: number
  choiceText: string
  selectionCount: number
  selectedCount: number
  skippedCount: number
  optionIndex: number
  [key: string]: any
}

class AnalyticsStore {
  getStoryAnalytics(storyId: string): StoryAnalytics {
    return {
      totalReaders: 0,
      completionRate: 0,
      averageReadTime: 0,
      averageDwellTime: 0,
      lastUpdated: Date.now(),
      totalSessions: 0,
      uniqueReaders: 0,
      totalTime: 0,
      completionCount: 0,
      nodeVisits: [],
      choices: [],
      choiceDistribution: [],
    }
  }
  recordVisit(storyId: string, nodeId: string): void {}
  recordChoice(storyId: string, sourceNodeId: string, choiceIndex: number): void {}
  clearStory(storyId: string): void {}
  clearAll(): void {}
  loadFromStorage(): void {}
}

export const analyticsStore = new AnalyticsStore()

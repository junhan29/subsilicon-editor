export interface WritingSession {
  id: string
  workId: string
  startTime: number
  endTime: number
  duration: number
  wordCountDelta: number
  nodeCountDelta: number
  actions: number
}

export interface WritingStats {
  totalTime: number
  totalSessions: number
  totalWords: number
  totalNodes: number
  todayTime: number
  weekTime: number
  monthTime: number
  streakDays: number
  lastActiveDate: string
  dailyStats: Record<string, { time: number; words: number; sessions: number }>
  sessions: WritingSession[]
}

const STORAGE_KEY_PREFIX = 'subsilicon-stats'
const IDLE_TIMEOUT = 5 * 60 * 1000
const MAX_SESSIONS = 100
const ACTION_DEBOUNCE_MS = 300

interface ActiveSession {
  workId: string
  startTime: number
  lastActionTime: number
  wordCountDelta: number
  nodeCountDelta: number
  actions: number
  paused: boolean
  pauseStartTime: number
  accumulatedPauseTime: number
}

const activeSessions = new Map<string, ActiveSession>()
let actionTimers = new Map<string, number>()

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function getStorageKey(workId: string): string {
  return `${STORAGE_KEY_PREFIX}-${workId}`
}

function getDateString(timestamp: number): string {
  const d = new Date(timestamp)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isToday(dateStr: string): boolean {
  return dateStr === getDateString(Date.now())
}

function isThisWeek(dateStr: string): boolean {
  const now = new Date()
  const dayOfWeek = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - dayOfWeek + 1)
  monday.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  return target >= monday
}

function isThisMonth(dateStr: string): boolean {
  const now = new Date()
  const target = new Date(dateStr)
  return now.getFullYear() === target.getFullYear() && now.getMonth() === target.getMonth()
}

function calculateStreak(dailyStats: Record<string, { time: number; words: number; sessions: number }>): number {
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = getDateString(d.getTime())
    const stat = dailyStats[dateStr]
    if (stat && stat.time > 0) {
      streak++
    } else if (i > 0) {
      break
    }
  }
  return streak
}

function countWords(nodes: unknown[]): number {
  let count = 0
  if (!Array.isArray(nodes)) return count
  for (const node of nodes) {
    if (node && typeof node === 'object') {
      const n = node as Record<string, unknown>
      const data = n.data as Record<string, unknown> | undefined
      if (data) {
        if (typeof data.text === 'string') {
          count += data.text.length
        }
        if (typeof data.prompt === 'string') {
          count += data.prompt.length
        }
        if (typeof data.title === 'string') {
          count += data.title.length
        }
        if (Array.isArray(data.options)) {
          for (const opt of data.options) {
            if (opt && typeof opt === 'object') {
              const optObj = opt as Record<string, unknown>
              if (typeof optObj.text === 'string') {
                count += optObj.text.length
              }
            }
          }
        }
      }
    }
  }
  return count
}

function createEmptyStats(): WritingStats {
  return {
    totalTime: 0,
    totalSessions: 0,
    totalWords: 0,
    totalNodes: 0,
    todayTime: 0,
    weekTime: 0,
    monthTime: 0,
    streakDays: 0,
    lastActiveDate: '',
    dailyStats: {},
    sessions: [],
  }
}

function validateStats(value: unknown): value is WritingStats {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.totalTime === 'number' &&
    typeof v.totalSessions === 'number' &&
    typeof v.totalWords === 'number' &&
    typeof v.totalNodes === 'number' &&
    typeof v.todayTime === 'number' &&
    typeof v.weekTime === 'number' &&
    typeof v.monthTime === 'number' &&
    typeof v.streakDays === 'number' &&
    typeof v.lastActiveDate === 'string' &&
    typeof v.dailyStats === 'object' &&
    v.dailyStats !== null &&
    Array.isArray(v.sessions)
  )
}

export function loadStats(workId: string): WritingStats {
  if (!isBrowser()) return createEmptyStats()
  try {
    const raw = window.localStorage.getItem(getStorageKey(workId))
    if (!raw) return createEmptyStats()
    const parsed = JSON.parse(raw)
    if (validateStats(parsed)) return parsed
    return createEmptyStats()
  } catch {
    return createEmptyStats()
  }
}

export function saveStats(workId: string, stats: WritingStats): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(getStorageKey(workId), JSON.stringify(stats))
  } catch {
  }
}

function recomputeDerivedStats(stats: WritingStats): WritingStats {
  let todayTime = 0
  let weekTime = 0
  let monthTime = 0

  for (const [dateStr, stat] of Object.entries(stats.dailyStats)) {
    if (isToday(dateStr)) {
      todayTime += stat.time
    }
    if (isThisWeek(dateStr)) {
      weekTime += stat.time
    }
    if (isThisMonth(dateStr)) {
      monthTime += stat.time
    }
  }

  const streakDays = calculateStreak(stats.dailyStats)

  return {
    ...stats,
    todayTime,
    weekTime,
    monthTime,
    streakDays,
  }
}

function addSessionToStats(stats: WritingStats, session: WritingSession): WritingStats {
  const dateStr = getDateString(session.startTime)

  const newSessions = [session, ...stats.sessions].slice(0, MAX_SESSIONS)

  const newDailyStats = { ...stats.dailyStats }
  if (!newDailyStats[dateStr]) {
    newDailyStats[dateStr] = { time: 0, words: 0, sessions: 0 }
  }
  newDailyStats[dateStr] = {
    time: newDailyStats[dateStr].time + session.duration,
    words: newDailyStats[dateStr].words + session.wordCountDelta,
    sessions: newDailyStats[dateStr].sessions + 1,
  }

  const updated: WritingStats = {
    ...stats,
    totalTime: stats.totalTime + session.duration,
    totalSessions: stats.totalSessions + 1,
    totalWords: Math.max(0, stats.totalWords + session.wordCountDelta),
    totalNodes: Math.max(0, stats.totalNodes + session.nodeCountDelta),
    lastActiveDate: dateStr,
    dailyStats: newDailyStats,
    sessions: newSessions,
  }

  return recomputeDerivedStats(updated)
}

export function startSession(workId: string): void {
  if (activeSessions.has(workId)) {
    const existing = activeSessions.get(workId)!
    if (existing.paused) {
      existing.paused = false
      existing.accumulatedPauseTime += Date.now() - existing.pauseStartTime
    }
    existing.lastActionTime = Date.now()
    return
  }

  const now = Date.now()
  activeSessions.set(workId, {
    workId,
    startTime: now,
    lastActionTime: now,
    wordCountDelta: 0,
    nodeCountDelta: 0,
    actions: 0,
    paused: false,
    pauseStartTime: 0,
    accumulatedPauseTime: 0,
  })
}

export function endSession(workId: string): void {
  const session = activeSessions.get(workId)
  if (!session) return

  const now = Date.now()
  let effectiveEndTime = now
  if (session.paused) {
    effectiveEndTime = session.pauseStartTime
  }

  const effectiveDuration = Math.max(
    0,
    Math.floor((effectiveEndTime - session.startTime - session.accumulatedPauseTime) / 1000)
  )

  if (effectiveDuration >= 10) {
    const writingSession: WritingSession = {
      id: `session-${now}-${Math.random().toString(36).slice(2, 8)}`,
      workId,
      startTime: session.startTime,
      endTime: effectiveEndTime,
      duration: effectiveDuration,
      wordCountDelta: session.wordCountDelta,
      nodeCountDelta: session.nodeCountDelta,
      actions: session.actions,
    }

    const stats = loadStats(workId)
    const updated = addSessionToStats(stats, writingSession)
    saveStats(workId, updated)
  }

  activeSessions.delete(workId)
  if (actionTimers.has(workId)) {
    clearTimeout(actionTimers.get(workId)!)
    actionTimers.delete(workId)
  }
}

function checkIdle(workId: string): void {
  const session = activeSessions.get(workId)
  if (!session || session.paused) return

  const now = Date.now()
  if (now - session.lastActionTime >= IDLE_TIMEOUT) {
    session.paused = true
    session.pauseStartTime = now
  }
}

export function recordAction(
  workId: string,
  wordDelta?: number,
  nodeDelta?: number,
  currentNodes?: unknown[]
): void {
  const session = activeSessions.get(workId)
  if (!session) return

  const now = Date.now()

  if (session.paused) {
    session.paused = false
    session.accumulatedPauseTime += now - session.pauseStartTime
  }

  session.lastActionTime = now
  session.actions += 1

  if (wordDelta !== undefined) {
    session.wordCountDelta += wordDelta
  }
  if (nodeDelta !== undefined) {
    session.nodeCountDelta += nodeDelta
  }

  if (actionTimers.has(workId)) {
    clearTimeout(actionTimers.get(workId)!)
  }

  const timer = window.setTimeout(() => {
    checkIdle(workId)
    actionTimers.delete(workId)
  }, ACTION_DEBOUNCE_MS)
  actionTimers.set(workId, timer)
}

export function getStats(workId: string): WritingStats {
  const stats = loadStats(workId)
  return recomputeDerivedStats(stats)
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}秒`
  }
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  }
  if (minutes > 0) {
    return secs > 0 ? `${minutes}分${secs}秒` : `${minutes}分钟`
  }
  return `${secs}秒`
}

export function formatShortDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}h${minutes}m`
  }
  return `${minutes}m`
}

export function clearStats(workId: string): void {
  if (!isBrowser()) return
  try {
    window.localStorage.removeItem(getStorageKey(workId))
  } catch {
  }
}

export function exportStats(workId: string): string {
  const stats = getStats(workId)
  return JSON.stringify(stats, null, 2)
}

export function estimateWordCount(nodes: unknown[]): number {
  return countWords(nodes)
}

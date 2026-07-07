import { useEffect, useRef, useCallback } from 'react'
import {
  analyticsStore,
  startSession,
  endSession,
  recordNodeVisit,
  recordChoice,
  type AnalyticsSession,
} from '@editor/lib/analytics'

interface UseReaderAnalyticsOptions {
  storyId: string
  enabled?: boolean
}

export function useReaderAnalytics({ storyId, enabled = true }: UseReaderAnalyticsOptions) {
  const sessionIdRef = useRef<string | null>(null)
  const lastNodeIdRef = useRef<string | null>(null)
  const lastNodeEnterTimeRef = useRef<number>(0)

  const ensureSession = useCallback(async () => {
    if (!enabled || sessionIdRef.current) return

    const session = await startSession(storyId)
    sessionIdRef.current = session.id
  }, [storyId, enabled])

  const onNodeEnter = useCallback(
    async (nodeId: string, nodeType?: string) => {
      if (!enabled) return

      await ensureSession()

      if (lastNodeIdRef.current && lastNodeIdRef.current !== nodeId) {
        const dwellTime = Date.now() - lastNodeEnterTimeRef.current
        if (dwellTime > 0) {
          await recordNodeVisit(storyId, lastNodeIdRef.current, {
            nodeType,
            dwellTime,
            sessionId: sessionIdRef.current || undefined,
          })
        }
      }

      lastNodeIdRef.current = nodeId
      lastNodeEnterTimeRef.current = Date.now()
    },
    [storyId, enabled, ensureSession]
  )

  const onChoice = useCallback(
    async (nodeId: string, choiceIndex: number, choiceText: string) => {
      if (!enabled) return

      await ensureSession()

      await recordChoice(storyId, nodeId, choiceIndex, choiceText, {
        sessionId: sessionIdRef.current || undefined,
      })
    },
    [storyId, enabled, ensureSession]
  )

  const onStoryEnd = useCallback(async () => {
    if (!enabled) return

    if (lastNodeIdRef.current) {
      const dwellTime = Date.now() - lastNodeEnterTimeRef.current
      if (dwellTime > 0) {
        await recordNodeVisit(storyId, lastNodeIdRef.current, {
          dwellTime,
          sessionId: sessionIdRef.current || undefined,
        })
      }
    }

    if (sessionIdRef.current) {
      await endSession(sessionIdRef.current)
      sessionIdRef.current = null
    }

    lastNodeIdRef.current = null
    lastNodeEnterTimeRef.current = 0
  }, [storyId, enabled])

  useEffect(() => {
    ensureSession()

    return () => {
      if (sessionIdRef.current) {
        endSession(sessionIdRef.current).catch(() => {})
      }
    }
  }, [ensureSession])

  return {
    onNodeEnter,
    onChoice,
    onStoryEnd,
  }
}

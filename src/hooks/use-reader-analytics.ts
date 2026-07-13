import { useEffect, useRef, useCallback } from 'react'
import {
  startSession,
  endSession,
  recordAction,
  type ReaderSession,
} from '@editor/lib/analytics-store'

interface UseReaderAnalyticsOptions {
  storyId: string
  enabled?: boolean
}

export function useReaderAnalytics({ storyId, enabled = true }: UseReaderAnalyticsOptions) {
  const sessionIdRef = useRef<string | null>(null)
  const lastNodeIdRef = useRef<string | null>(null)
  const lastNodeEnterTimeRef = useRef<number>(0)

  const ensureSession = useCallback(() => {
    if (!enabled || sessionIdRef.current) return

    const session = startSession(storyId)
    sessionIdRef.current = session.id
  }, [storyId, enabled])

  const onNodeEnter = useCallback(
    (nodeId: string, nodeType?: string) => {
      if (!enabled) return

      ensureSession()

      if (lastNodeIdRef.current && lastNodeIdRef.current !== nodeId) {
        const dwellTime = Date.now() - lastNodeEnterTimeRef.current
        if (dwellTime > 0) {
          recordAction({
            type: 'nodeLeave',
            nodeId: lastNodeIdRef.current,
            nodeType,
            duration: dwellTime,
          })
        }
      }

      recordAction({
        type: 'nodeEnter',
        nodeId,
        nodeType,
      })

      lastNodeIdRef.current = nodeId
      lastNodeEnterTimeRef.current = Date.now()
    },
    [enabled, ensureSession]
  )

  const onChoice = useCallback(
    (nodeId: string, choiceIndex: number, choiceText: string) => {
      if (!enabled) return

      ensureSession()

      recordAction({
        type: 'choice',
        nodeId,
        choiceOptionId: String(choiceIndex),
        choiceOptionText: choiceText,
      })
    },
    [enabled, ensureSession]
  )

  const onStoryEnd = useCallback(() => {
    if (!enabled) return

    if (lastNodeIdRef.current) {
      const dwellTime = Date.now() - lastNodeEnterTimeRef.current
      if (dwellTime > 0) {
        recordAction({
          type: 'nodeLeave',
          nodeId: lastNodeIdRef.current,
          duration: dwellTime,
        })
      }
    }

    endSession()
    sessionIdRef.current = null
    lastNodeIdRef.current = null
    lastNodeEnterTimeRef.current = 0
  }, [enabled])

  useEffect(() => {
    ensureSession()

    return () => {
      if (sessionIdRef.current) {
        endSession()
      }
    }
  }, [ensureSession])

  return {
    onNodeEnter,
    onChoice,
    onStoryEnd,
  }
}

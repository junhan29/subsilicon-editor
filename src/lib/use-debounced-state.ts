'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export function useDebouncedState<T>(
  initialValue: T,
  delay: number = 300,
  onDebouncedChange?: (value: T) => void
): [T, (value: T) => void, () => void] {
  const [value, setValue] = useState<T>(initialValue)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const callbackRef = useRef(onDebouncedChange)
  callbackRef.current = onDebouncedChange

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  const debouncedSetValue = useCallback((newValue: T) => {
    setValue(newValue)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => {
      callbackRef.current?.(newValue)
    }, delay)
  }, [delay])

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    callbackRef.current?.(value)
  }, [value])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return [value, debouncedSetValue, flush]
}

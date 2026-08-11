'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface UseDebouncedStateOptions {
  /**
   * 卸载时是否 flush 防抖窗口内未写回的编辑。
   * 用于 AI 辅助按钮直接 setText 后 300ms 内退出面板/返回项目的场景——
   * 该路径不触发 onBlur，卸载只 clearTimeout 会丢数据。
   */
  flushOnUnmount?: boolean
}

export function useDebouncedState<T>(
  initialValue: T,
  delay: number = 300,
  onDebouncedChange?: (value: T) => void,
  options?: UseDebouncedStateOptions
): [T, (value: T) => void, () => void] {
  const [value, setValue] = useState<T>(initialValue)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const callbackRef = useRef(onDebouncedChange)
  callbackRef.current = onDebouncedChange
  const valueRef = useRef(value)
  valueRef.current = value
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      return
    }
    // 外部值变化（撤销/切换节点/加载新数据）：取消 pending 的防抖回调，
    // 否则 delay 后回调会把「旧输入值」写回新节点/已撤销的数据，导致撤销无效。
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
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
        timerRef.current = null
      }
      // 卸载时 flush 未写回的编辑（选项启用时），防抖窗口内的修改必须落盘
      if (options?.flushOnUnmount && callbackRef.current) {
        callbackRef.current(valueRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return [value, debouncedSetValue, flush]
}

'use client'

import { createContext, useContext, useCallback, useRef, useState, memo } from 'react'

interface A11yAnnouncerContextType {
  announce: (message: string) => void
}

const A11yAnnouncerContext = createContext<A11yAnnouncerContextType | null>(null)

export function useA11yAnnouncer(): A11yAnnouncerContextType {
  const context = useContext(A11yAnnouncerContext)
  if (!context) {
    return { announce: () => {} }
  }
  return context
}

interface A11yAnnouncerProps {
  children: any
}

function A11yAnnouncerComponent({ children }: A11yAnnouncerProps) {
  const [message, setMessage] = useState('')
  const timeoutRef = useRef<number | null>(null)

  const announce = useCallback((msg: string) => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
    }
    setMessage('')
    timeoutRef.current = window.setTimeout(() => {
      setMessage(msg)
    }, 50)
  }, [])

  const contextValue = { announce }

  return (
    <A11yAnnouncerContext.Provider value={contextValue}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: '0',
        }}
      >
        {message}
      </div>
    </A11yAnnouncerContext.Provider>
  )
}

export const A11yAnnouncer = memo(A11yAnnouncerComponent)
export default A11yAnnouncer

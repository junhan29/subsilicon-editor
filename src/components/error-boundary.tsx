import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

const IS_DEV = (() => {
  try {
    return (import.meta as any).env?.DEV === true
  } catch {
    return false
  }
})()

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="w-full h-full flex items-center justify-center p-6 bg-[hsl(var(--silicon-950))]">
          <div className="max-w-md w-full bg-[hsl(var(--silicon-900))] border border-[hsl(var(--silicon-800))] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">出现错误</h3>
                <p className="text-sm text-[hsl(var(--silicon-foreground)/0.6)]">
                  页面发生了意外错误
                </p>
              </div>
            </div>

            {this.state.error && IS_DEV && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-xs font-mono text-red-300 break-all">
                  {this.state.error.message}
                </p>
                {this.state.error.stack && (
                  <details className="mt-2">
                    <summary className="text-xs text-red-400 cursor-pointer hover:text-red-300">
                      查看堆栈
                    </summary>
                    <pre className="mt-2 text-xs text-red-300/70 overflow-auto max-h-40 whitespace-pre-wrap">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-ochre-500 to-terracotta text-white rounded-lg hover:brightness-110 transition-all active:scale-[0.98]"
            >
              <RefreshCw className="w-4 h-4" />
              <span>重试</span>
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

'use client'

import { useState, useEffect, useCallback, useRef, memo } from 'react'
import {
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Upload,
  Download,
  Copy,
  Trash2,
  Info,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import { Input } from '@editor/components/ui/input'
import { Label } from '@editor/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@editor/components/ui/sheet'
import {
  loadWebDAVConfig,
  saveWebDAVConfig,
  clearWebDAVConfig,
  testConnection,
  syncWorks,
  resolveConflict,
  subscribeSyncState,
  subscribeSyncLog,
  type SyncState,
  type SyncLogEntry,
  type WebDAVConfig,
} from '@editor/lib/sync-manager'
import { loadWork, type StoredWork } from '@editor/lib/local-db/work-store'

interface SyncSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SyncSettings = memo(function SyncSettings({ open, onOpenChange }: SyncSettingsProps) {
  const [config, setConfig] = useState<WebDAVConfig>({
    url: '',
    username: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionResult, setConnectionResult] = useState<'success' | 'error' | null>(null)
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    conflicts: [],
  })
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([])
  const [conflictWorks, setConflictWorks] = useState<Map<string, StoredWork | null>>(new Map())
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = loadWebDAVConfig()
    if (saved) {
      setConfig(saved)
    }
  }, [open])

  useEffect(() => {
    const unsubscribe = subscribeSyncState((state) => {
      setSyncState(state)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeSyncLog((logs) => {
      setSyncLog([...logs])
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight
    }
  }, [syncLog])

  useEffect(() => {
    const fetchConflictWorks = async () => {
      const works = new Map<string, StoredWork | null>()
      for (const workId of syncState.conflicts) {
        try {
          const work = await loadWork(workId)
          works.set(workId, work)
        } catch {
          works.set(workId, null)
        }
      }
      setConflictWorks(works)
    }
    if (syncState.conflicts.length > 0) {
      fetchConflictWorks()
    }
  }, [syncState.conflicts])

  const handleTestConnection = useCallback(async () => {
    if (!config.url || !config.username || !config.password) {
      setConnectionResult('error')
      return
    }

    setTestingConnection(true)
    setConnectionResult(null)

    try {
      const success = await testConnection(config)
      setConnectionResult(success ? 'success' : 'error')
    } catch {
      setConnectionResult('error')
    } finally {
      setTestingConnection(false)
    }
  }, [config])

  const handleSaveConfig = useCallback(() => {
    saveWebDAVConfig(config)
  }, [config])

  const handleClearConfig = useCallback(() => {
    clearWebDAVConfig()
    setConfig({ url: '', username: '', password: '' })
    setConnectionResult(null)
  }, [])

  const handleSync = useCallback(async () => {
    try {
      await syncWorks()
    } catch {
      // 错误已在 sync-manager 中处理
    }
  }, [])

  const handleResolveConflict = useCallback(
    async (workId: string, choose: 'local' | 'remote' | 'both') => {
      try {
        await resolveConflict(workId, choose)
      } catch (error) {
        console.error('Resolve conflict failed:', error)
      }
    },
    []
  )

  const getStatusIcon = () => {
    switch (syncState.status) {
      case 'syncing':
        return <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />
      case 'conflict':
        return <AlertTriangle className="w-5 h-5 text-amber-400" />
      default:
        return <Cloud className="w-5 h-5 text-slate-400" />
    }
  }

  const getStatusText = () => {
    switch (syncState.status) {
      case 'syncing':
        return '同步中...'
      case 'success':
        return '同步成功'
      case 'error':
        return '同步失败'
      case 'conflict':
        return '存在冲突'
      default:
        return '未同步'
    }
  }

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '从未同步'
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  const isConfigValid = config.url && config.username && config.password

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-slate-900 border-slate-700 text-white overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="text-white flex items-center gap-2">
            <Cloud className="w-5 h-5" />
            WebDAV 同步设置
          </SheetTitle>
          <SheetDescription className="text-slate-400">
            通过 WebDAV 协议同步作品到云端网盘
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white">连接配置</h3>
            
            <div className="space-y-2">
              <Label htmlFor="webdav-url" className="text-slate-300">
                WebDAV 地址
              </Label>
              <Input
                id="webdav-url"
                placeholder="https://dav.jianguoyun.com/dav/"
                value={config.url}
                onChange={(e) => setConfig({ ...config, url: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="webdav-username" className="text-slate-300">
                用户名
              </Label>
              <Input
                id="webdav-username"
                placeholder="your@email.com"
                value={config.username}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="webdav-password" className="text-slate-300">
                应用密码
              </Label>
              <div className="relative">
                <Input
                  id="webdav-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="应用专用密码"
                  value={config.password}
                  onChange={(e) => setConfig({ ...config, password: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={testingConnection || !isConfigValid}
                className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                {testingConnection ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : connectionResult === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : connectionResult === 'error' ? (
                  <XCircle className="w-4 h-4 text-red-400" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                测试连接
              </Button>
              <Button
                size="sm"
                onClick={handleSaveConfig}
                disabled={!isConfigValid}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
              >
                保存配置
              </Button>
            </div>

            {connectionResult === 'success' && (
              <p className="text-xs text-green-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                连接成功
              </p>
            )}
            {connectionResult === 'error' && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                连接失败，请检查配置
              </p>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearConfig}
              className="w-full text-slate-400 hover:text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4" />
              清除配置
            </Button>
          </div>

          <div className="border-t border-slate-800 pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">同步状态</h3>
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <span className="text-sm text-slate-300">{getStatusText()}</span>
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">上次同步</span>
                <span className="text-slate-300">{formatTime(syncState.lastSyncTime)}</span>
              </div>
              {syncState.progress !== undefined && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">进度</span>
                    <span className="text-slate-300">{syncState.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${syncState.progress}%` }}
                    />
                  </div>
                  {syncState.currentFile && (
                    <p className="text-xs text-slate-500 truncate">
                      {syncState.currentFile}
                    </p>
                  )}
                </div>
              )}
              {syncState.error && (
                <div className="text-xs text-red-400 bg-red-500/10 rounded p-2">
                  {syncState.error}
                </div>
              )}
            </div>

            <Button
              size="sm"
              onClick={handleSync}
              disabled={syncState.status === 'syncing' || !isConfigValid}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white"
            >
              <RefreshCw className={`w-4 h-4 ${syncState.status === 'syncing' ? 'animate-spin' : ''}`} />
              {syncState.status === 'syncing' ? '同步中...' : '立即同步'}
            </Button>
          </div>

          {syncState.conflicts.length > 0 && (
            <div className="border-t border-slate-800 pt-6 space-y-4">
              <h3 className="text-sm font-medium text-amber-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                冲突作品 ({syncState.conflicts.length})
              </h3>
              <div className="space-y-2">
                {syncState.conflicts.map((workId) => {
                  const work = conflictWorks.get(workId)
                  return (
                    <div
                      key={workId}
                      className="bg-slate-800/50 rounded-lg p-3 space-y-2"
                    >
                      <p className="text-sm text-white font-medium">
                        {work?.name || workId}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResolveConflict(workId, 'local')}
                          className="flex-1 text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
                        >
                          <Upload className="w-3 h-3" />
                          保留本地
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResolveConflict(workId, 'remote')}
                          className="flex-1 text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
                        >
                          <Download className="w-3 h-3" />
                          保留云端
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResolveConflict(workId, 'both')}
                          className="flex-1 text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
                        >
                          <Copy className="w-3 h-3" />
                          都保留
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="border-t border-slate-800 pt-6 space-y-4">
            <h3 className="text-sm font-medium text-white">同步日志</h3>
            <div
              ref={logEndRef}
              className="bg-slate-950 rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs space-y-1"
            >
              {syncLog.length === 0 ? (
                <p className="text-slate-600">暂无日志</p>
              ) : (
                syncLog.map((entry, index) => (
                  <div
                    key={index}
                    className={`flex gap-2 ${
                      entry.type === 'success'
                        ? 'text-green-400'
                        : entry.type === 'error'
                        ? 'text-red-400'
                        : entry.type === 'warning'
                        ? 'text-amber-400'
                        : 'text-slate-400'
                    }`}
                  >
                    <span className="text-slate-600 shrink-0">
                      {new Date(entry.timestamp).toLocaleTimeString('zh-CN')}
                    </span>
                    <span>{entry.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                <div className="space-y-2">
                  <p className="text-xs text-blue-300 font-medium">支持的网盘服务</p>
                  <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                    <li>坚果云 (推荐，支持 CORS)</li>
                    <li>ownCloud / Nextcloud</li>
                    <li>群晖 WebDAV</li>
                    <li>其他支持 WebDAV 协议的服务</li>
                  </ul>
                  <p className="text-xs text-slate-400 pt-1">
                    应用密码请在对应网盘的设置中生成，不要使用登录密码。
                  </p>
                  <p className="text-xs text-amber-400/80 pt-1">
                    注意：密码以 base64 编码保存在本地，不是加密存储。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
})

export { SyncSettings }

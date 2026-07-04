'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Lock, Unlock, Key, Copy, CheckCircle2, Clock, FileText, AlertCircle } from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import { showToast } from './toast'
import {
  generateUnlockCode,
  loadSeedKey,
  loadAllSeedKeys,
  UNLOCK_REQUEST_PREFIX,
  UNLOCK_CODE_PREFIX,
  SEED_KEY_PREFIX,
} from '@editor/lib/work-monetization'
import type { UnlockCode } from '@editor/lib/work-monetization'

interface UnlockCodeGeneratorProps {
  workId: string
  paidChapters?: Array<{ id: string; name: string; price: number }>
}

interface GeneratedCodeRecord {
  requestCode: string
  unlockCode: string
  chapterId?: string
  chapterName?: string
  validHours?: number
  createdAt: number
}

export function UnlockCodeGenerator({ workId, paidChapters }: UnlockCodeGeneratorProps) {
  // 种子密钥状态
  const [seedKey, setSeedKey] = useState<string>('')
  const [showSeedKey, setShowSeedKey] = useState(false)
  
  // 解锁请求输入
  const [requestCodeInput, setRequestCodeInput] = useState<string>('')
  const [requestCodeValid, setRequestCodeValid] = useState<boolean>(false)
  
  // 章节选择
  const [selectedChapterId, setSelectedChapterId] = useState<string>('all')
  
  // 有效期设置
  const [validHours, setValidHours] = useState<number>(0) // 0 = 永久
  
  // 生成状态
  const [generating, setGenerating] = useState<boolean>(false)
  const [generatedCode, setGeneratedCode] = useState<UnlockCode | null>(null)
  
  // 历史记录
  const [history, setHistory] = useState<GeneratedCodeRecord[]>([])
  
  // 加载种子密钥
  useEffect(() => {
    const key = loadSeedKey(workId)
    if (key) {
      setSeedKey(key)
    }
  }, [workId])
  
  // 加载历史记录
  useEffect(() => {
    const historyKey = `subsilicon_unlock_history_${workId}`
    try {
      const data = localStorage.getItem(historyKey)
      if (data) {
        setHistory(JSON.parse(data))
      }
    } catch {
      setHistory([])
    }
  }, [workId])
  
  // 验证解锁请求凭证格式
  useEffect(() => {
    const valid = requestCodeInput.startsWith(UNLOCK_REQUEST_PREFIX) && 
                  requestCodeInput.length === UNLOCK_REQUEST_PREFIX.length + 8 &&
                  /^[A-F0-9]{8}$/i.test(requestCodeInput.slice(UNLOCK_REQUEST_PREFIX.length))
    setRequestCodeValid(valid)
  }, [requestCodeInput])
  
  // 章节选项
  const chapterOptions = useMemo(() => {
    const options = [{ id: 'all', name: '整本解锁', price: 0 }]
    if (paidChapters) {
      return [...options, ...paidChapters]
    }
    return options
  }, [paidChapters])
  
  // 有效期选项
  const validOptions = [
    { hours: 0, label: '永久有效' },
    { hours: 24, label: '24 小时' },
    { hours: 168, label: '7 天' },
    { hours: 720, label: '30 天' },
  ]
  
  // 生成解锁码
  const handleGenerate = useCallback(async () => {
    if (!seedKey) {
      showToast('error', '请先输入种子密钥')
      return
    }
    
    if (!requestCodeValid) {
      showToast('error', '解锁凭证格式错误')
      return
    }
    
    setGenerating(true)
    
    try {
      const chapterId = selectedChapterId === 'all' ? undefined : selectedChapterId
      const chapterName = selectedChapterId === 'all' ? '整本' : 
                          paidChapters?.find(ch => ch.id === selectedChapterId)?.name || selectedChapterId
      
      const code = await generateUnlockCode(
        seedKey,
        requestCodeInput,
        workId,
        chapterId,
        validHours === 0 ? undefined : validHours
      )
      
      setGeneratedCode(code)
      
      // 添加到历史记录
      const record: GeneratedCodeRecord = {
        requestCode: requestCodeInput,
        unlockCode: code.code,
        chapterId,
        chapterName,
        validHours: validHours === 0 ? undefined : validHours,
        createdAt: Date.now(),
      }
      
      const newHistory = [record, ...history].slice(0, 10) // 只保留最近 10 条
      setHistory(newHistory)
      
      // 保存到 localStorage
      const historyKey = `subsilicon_unlock_history_${workId}`
      localStorage.setItem(historyKey, JSON.stringify(newHistory))
      
      showToast('success', '解锁码已生成')
    } catch (error) {
      showToast('error', '生成失败：' + (error as Error).message)
    } finally {
      setGenerating(false)
    }
  }, [seedKey, requestCodeInput, requestCodeValid, selectedChapterId, validHours, workId, paidChapters, history])
  
  // 复制解锁码
  const handleCopyCode = useCallback(() => {
    if (!generatedCode) return
    
    navigator.clipboard.writeText(generatedCode.code).then(() => {
      showToast('success', '已复制到剪贴板')
    }).catch(() => {
      // Fallback
      const textarea = document.createElement('textarea')
      textarea.value = generatedCode.code
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      showToast('success', '已复制到剪贴板')
    })
  }, [generatedCode])
  
  // 从历史记录复制
  const handleCopyFromHistory = useCallback((code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      showToast('success', '已复制到剪贴板')
    }).catch(() => {
      const textarea = document.createElement('textarea')
      textarea.value = code
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      showToast('success', '已复制到剪贴板')
    })
  }, [])
  
  return (
    <div className="space-y-4">
      {/* 种子密钥 */}
      <div className="p-4 bg-muted/30 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            <span className="font-medium">种子密钥</span>
          </div>
          <button
            onClick={() => setShowSeedKey(!showSeedKey)}
            className="p-1.5 rounded hover:bg-muted transition-colors"
          >
            {showSeedKey ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </button>
        </div>
        
        {seedKey ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg font-mono text-sm">
              {showSeedKey ? seedKey : SEED_KEY_PREFIX + '••••••••••••••••••••••••••••••••'}
            </div>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </div>
        ) : (
          <input
            type="text"
            value={seedKey}
            onChange={(e) => setSeedKey(e.target.value)}
            placeholder="输入种子密钥"
            className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        )}
        
        {!seedKey && (
          <p className="text-xs text-orange-500 flex items-center gap-1 mt-2">
            <AlertCircle className="w-3 h-3" />
            请输入作品导出时生成的种子密钥
          </p>
        )}
      </div>
      
      {/* 解锁凭证输入 */}
      <div>
        <label className="text-sm font-medium mb-2 block">读者发来的解锁凭证</label>
        <input
          type="text"
          value={requestCodeInput}
          onChange={(e) => setRequestCodeInput(e.target.value.toUpperCase())}
          placeholder="SUBSL-REQ-XXXXXXXX"
          maxLength={UNLOCK_REQUEST_PREFIX.length + 8}
          className={`w-full px-3 py-2 bg-muted border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 ${
            requestCodeInput.length > 0 && !requestCodeValid
              ? 'border-red-500 focus:ring-red-500/50'
              : 'border-border focus:ring-primary/50'
          }`}
        />
        {requestCodeInput.length > 0 && (
          <p className={`text-xs mt-1 flex items-center gap-1 ${
            requestCodeValid ? 'text-green-500' : 'text-red-500'
          }`}>
            {requestCodeValid ? (
              <>
                <CheckCircle2 className="w-3 h-3" />
                格式正确
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3" />
                格式错误，应为 SUBSL-REQ-XXXXXXXX（8位十六进制）
              </>
            )}
          </p>
        )}
      </div>
      
      {/* 章节选择 */}
      {paidChapters && paidChapters.length > 0 && (
        <div>
          <label className="text-sm font-medium mb-2 block">解锁范围</label>
          <select
            value={selectedChapterId}
            onChange={(e) => setSelectedChapterId(e.target.value)}
            className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {chapterOptions.map(opt => (
              <option key={opt.id} value={opt.id}>
                {opt.name} {opt.price > 0 ? `（¥${opt.price.toFixed(2)}）` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {/* 有效期设置 */}
      <div>
        <label className="text-sm font-medium mb-2 block flex items-center gap-2">
          <Clock className="w-4 h-4" />
          有效期
        </label>
        <div className="flex gap-2">
          {validOptions.map(opt => (
            <button
              key={opt.hours}
              onClick={() => setValidHours(opt.hours)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                validHours === opt.hours
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* 生成按钮 */}
      <Button
        onClick={handleGenerate}
        disabled={!seedKey || !requestCodeValid || generating}
        className="w-full"
      >
        {generating ? (
          <>
            <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
            正在生成...
          </>
        ) : (
          <>
            <Lock className="w-4 h-4 mr-2" />
            生成解锁码
          </>
        )}
      </Button>
      
      {/* 生成的解锁码 */}
      {generatedCode && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-500">解锁码已生成</span>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </div>
          
          <div className="bg-muted border border-border rounded-lg p-3 font-mono text-lg text-center mb-3">
            {generatedCode.code}
          </div>
          
          <Button
            onClick={handleCopyCode}
            size="sm"
            className="w-full"
          >
            <Copy className="w-4 h-4 mr-2" />
            复制解锁码
          </Button>
          
          {generatedCode.chapterId && (
            <p className="text-xs text-muted-foreground mt-2">
              解锁章节：{paidChapters?.find(ch => ch.id === generatedCode.chapterId)?.name || generatedCode.chapterId}
            </p>
          )}
          
          {generatedCode.validUntil && generatedCode.validUntil > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              有效期至：{new Date(generatedCode.validUntil).toLocaleString('zh-CN')}
            </p>
          )}
        </div>
      )}
      
      {/* 历史记录 */}
      {history.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">最近生成记录</span>
          </div>
          
          <div className="max-h-[200px] overflow-y-auto space-y-2">
            {history.map((record, i) => (
              <div
                key={i}
                className="p-2 bg-muted/30 border border-border rounded-lg flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground truncate mb-1">
                    凭证：{record.requestCode}
                  </div>
                  <div className="text-sm font-mono truncate">
                    {record.unlockCode}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{record.chapterName || '整本'}</span>
                    {record.validHours && <span>• {record.validHours}h</span>}
                    <span>• {new Date(record.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleCopyFromHistory(record.unlockCode)}
                  className="p-1.5 rounded hover:bg-muted transition-colors"
                  title="复制"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 使用提示 */}
      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-xs text-muted-foreground">
          <strong className="text-blue-500">使用流程：</strong>
          读者支付后 → 发来解锁凭证（SUBSL-REQ-XXXX） → 你生成解锁码 → 发给读者 → 读者粘贴解锁
        </p>
      </div>
    </div>
  )
}
/** B1. 我的摊位工作台 —— 模块化后根组件
 *  布局：顶栏（save/account） + 左 60 宽侧边栏（导航 tabs） + 右侧 Tab 内容区
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Booth } from '@editor/lib/booth/types'
import { createEmptyBooth, defaultPreviewForType } from '@editor/lib/booth/types'
import { ensureBooth, saveBooth } from '@editor/lib/booth/store'
import { collectBoothItems, saveBoothZip } from '@editor/lib/booth/pack'
import type { StoredWork } from '@editor/lib/local-db/work-store'
import { getAllWorks } from '@editor/lib/local-db/work-store'
import { showToast } from '@editor/components/editor/toast'
import {
  getAccount,
  isLoggedIn,
  logout,
  type LocalAccount,
} from '@editor/lib/local-account-store'
import { validateDownloadLinks } from '@editor/lib/creator-service'

import { BoothTopBar } from './booth-top-bar'
import { BoothSidebar, type BoothTabKey } from './booth-sidebar'
import { DisplayTab } from './tabs/display-tab'
import { SettingsTab } from './tabs/settings-tab'
import { MonetizeTab } from './tabs/monetize-tab'
import { PackTab } from './tabs/pack-tab'
import { AboutTab } from './tabs/about-tab'

type AccountLite = Omit<LocalAccount, 'passwordHash'>
interface BoothWorkbenchProps { onBack: () => void }
type HighlightKey = 'downloadLinks' | null

export function BoothWorkbench({ onBack }: BoothWorkbenchProps) {
  const [booth, setBooth] = useState<Booth | null>(null)
  const [works, setWorks] = useState<StoredWork[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<BoothTabKey>('display')
  const [saved, setSaved] = useState(true)
  const [account, setAccount] = useState<AccountLite | null>(isLoggedIn() ? getAccount() : null)
  const [hasPackedOnce, setHasPackedOnce] = useState(false)
  const [highlight, setHighlight] = useState<HighlightKey>(null)
  const [dlCount, setDlCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [b, w] = await Promise.all([ensureBooth(), getAllWorks()])
        if (cancelled) return
        setBooth(b)
        setWorks(w)
        setAccount(isLoggedIn() ? getAccount() : null)
      } catch (err) {
        console.error('加载摊位失败:', err)
        showToast('error', '摊位加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const persist = useCallback((next: Booth) => {
    setBooth(next)
    setSaved(false)
    void saveBooth(next)
      .then(() => setSaved(true))
      .catch((err) => {
        console.error('保存摊位失败:', err)
        showToast('error', '摊位保存失败')
      })
  }, [])

  const updateCreator = useCallback(
    (patch: Partial<Booth['creator']>) => {
      setBooth((prev) => {
        if (!prev) return prev
        const next = { ...prev, creator: { ...prev.creator, ...patch }, updatedAt: Date.now() }
        persist(next)
        return next
      })
    },
    [persist]
  )

  const handleRequestLogin = () => {
    // 简化：弹出一个小提示引导用户到注册/登录入口（顶栏自身逻辑）
    showToast('info', '请在顶栏点击「生成创作令牌」完成创作者身份绑定')
  }

  const onJumpToTab = (t: BoothTabKey, h?: HighlightKey) => {
    setTab(t)
    if (h) {
      setHighlight(h)
      setTimeout(() => setHighlight(null), 2400)
    }
  }

  const onWorkAction = (act: 'pack' | 'edit' | 'upload' | 'copyId', workId: string) => {
    if (act === 'pack') {
      setTab('pack')
      setHasPackedOnce(true)
      showToast('info', '已跳转到打包发布 Tab')
      return
    }
    if (act === 'edit') {
      showToast('info', '编辑作品：返回编辑器主界面定位对应作品（' + workId.slice(0, 8) + '）')
      return
    }
    if (act === 'upload') {
      setTab('display')
      return
    }
  }

  const onCreateWork = () => {
    setBooth((prev) => {
      if (!prev) return prev
      const already = new Set(prev.display.order)
      const w = works.find((x) => !already.has(x.id))
      if (!w) {
        showToast('info', '暂无可上架作品；请先在编辑器创建一个。')
        return prev
      }
      // 如果 booth.works 已经有这个 workId，就只追加到 order
      const existingEntry = prev.works.find((e) => e.workId === w.id)
      const entry = existingEntry || {
        workId: w.id,
        workType: w.workType || 'interactive-narrative',
        preview: defaultPreviewForType(w.workType || 'interactive-narrative'),
        pricing: { override: false },
        addedAt: Date.now(),
      }
      const nextWorks = existingEntry ? prev.works : prev.works.concat(entry)
      const nextOrder = prev.display.order.includes(w.id)
        ? prev.display.order
        : prev.display.order.concat(w.id)
      const next = {
        ...prev,
        works: nextWorks,
        display: { ...prev.display, order: nextOrder },
        updatedAt: Date.now(),
      }
      persist(next)
      showToast('success', '已上架一个陈列：' + w.name)
      return next
    })
  }

  const packItems = useMemo(() => {
    try { return booth ? collectBoothItems(booth, works) : [] }
    catch { return [] }
  }, [booth, works])

  // 下载渠道数量统计：从 channels.thirdParty + downloadLinks (若有的话) 估算
  useEffect(() => {
    if (!booth) { setDlCount(0); return }
    let n = booth.channels.thirdParty.length
    // 如果作品 monetization 有任何 downloadLinks 字段，按条目加
    for (const entry of booth.works) {
      const pr = entry.pricing
      if (pr && (pr as any).downloadLinks && Array.isArray((pr as any).downloadLinks)) {
        n += (pr as any).downloadLinks.length
      }
    }
    // 空数组仍触发一次校验以确保计数
    const v = validateDownloadLinks([], { allowEmpty: true })
    if (!v.ok) n = n || 0
    setDlCount(n)
    void 0
  }, [booth])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background text-muted-foreground text-xs">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        正在加载我的摊位…
      </div>
    )
  }
  if (!booth) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background text-muted-foreground text-xs">
        加载摊位失败，请返回重试。
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full h-full min-h-0 bg-background text-foreground">
      <BoothTopBar
        onBack={onBack}
        saved={saved}
        updatedAt={booth.updatedAt}
        onRequestLogin={handleRequestLogin}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <BoothSidebar active={tab} onChange={onJumpToTab} />
        <main className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col bg-card/20">
          {tab === 'display' && (
            <DisplayTab
              booth={booth}
              works={works}
              account={account}
              highlightDownloadLinks={highlight === 'downloadLinks'}
              onActionGlobal={onWorkAction}
              onCreateWork={onCreateWork}
            />
          )}
          {tab === 'settings' && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <SettingsTab booth={booth} updateCreator={updateCreator} />
            </div>
          )}
          {tab === 'monetize' && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <MonetizeTab
                isLoggedIn={!!account}
                downloadLinksCount={dlCount}
                hasPackedOnce={hasPackedOnce}
                onJump={(t, h) => onJumpToTab(t, h)}
              />
            </div>
          )}
          {tab === 'pack' && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <PackTab booth={booth} items={packItems} />
            </div>
          )}
          {tab === 'about' && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <AboutTab />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export { saveBoothZip }

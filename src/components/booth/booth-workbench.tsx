import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpenText,
  Check,
  Eye,
  ExternalLink,
  MessageCircle,
  Package,
  Plus,
  Save,
  Send,
  Star,
  Store,
  Trash2,
  X,
} from 'lucide-react'
import { type Booth, createEmptyBooth, DEFAULT_COMPLIANCE_NOTE } from '@editor/lib/booth/types'
import { ensureBooth, saveBooth } from '@editor/lib/booth/store'
import { collectBoothItems, generateBoothPreviewHTML, saveBoothZip } from '@editor/lib/booth/pack'
import { publishBooth, type BoothPublishOutcome } from '@editor/lib/booth/publish'
import type { StoredWork } from '@editor/lib/local-db/work-store'
import { getAllWorks } from '@editor/lib/local-db/work-store'
import { getDocumentFromWork } from '@editor/lib/local-db/work-store'
import { showToast } from '@editor/components/editor/toast'
import { getCurrentAccount, getPlatformConfigs } from '@editor/lib/creator-service'

const WORK_TYPE_NAMES: Record<string, string> = {
  'interactive-narrative': '互动叙事',
  novel: '小说',
  video: '视频',
  comic: '漫画',
}

const PREVIEW_TYPES = [
  { id: 'chapters', name: '章节' },
  { id: 'seconds', name: '秒' },
  { id: 'nodes', name: '节点' },
  { id: 'panels', name: '格' },
] as const

const MANUAL_KINDS = [
  { id: 'wechat', name: '微信' },
  { id: 'alipay', name: '支付宝' },
  { id: 'stripe', name: 'Stripe' },
  { id: 'paypal', name: 'PayPal' },
  { id: 'other', name: '其他' },
] as const

const THIRD_KINDS = [
  { id: 'afdian', name: '爱发电' },
  { id: 'mianbaoduo', name: '面包多' },
  { id: 'patreon', name: 'Patreon' },
  { id: 'ko-fi', name: 'Ko-fi' },
  { id: 'other', name: '其他' },
] as const

type SectionId = 'profile' | 'promo' | 'display' | 'pricing' | 'channels'

interface BoothWorkbenchProps {
  onBack: () => void
}

const inputCls =
  'w-full h-9 text-sm rounded-lg border border-slate-600 bg-slate-700 px-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50'
const labelCls = 'block text-xs text-slate-400 mb-1'

export function BoothWorkbench({ onBack }: BoothWorkbenchProps) {
  const [booth, setBooth] = useState<Booth | null>(null)
  const [works, setWorks] = useState<StoredWork[]>([])
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState<SectionId>('profile')
  const [saved, setSaved] = useState(true)
  const [publishResult, setPublishResult] = useState<BoothPublishOutcome | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [b, w] = await Promise.all([ensureBooth(), getAllWorks()])
        if (cancelled) return
        setBooth(b)
        setWorks(w)
      } catch (err) {
        console.error('加载摊位失败:', err)
        showToast('error', '摊位加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /** 更新摊位并持久化 */
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

  const updateBooth = useCallback(
    (patch: Partial<Booth>) => {
      if (!booth) return
      persist({ ...booth, ...patch })
    },
    [booth, persist]
  )

  const updateCreator = useCallback(
    (patch: Partial<Booth['creator']>) => {
      if (!booth) return
      persist({ ...booth, creator: { ...booth.creator, ...patch } })
    },
    [booth, persist]
  )

  const updateProfile = useCallback(
    (patch: Partial<Booth['profile']>) => {
      if (!booth) return
      persist({ ...booth, profile: { ...booth.profile, ...patch } })
    },
    [booth, persist]
  )

  const boothWorks = useMemo(() => {
    if (!booth) return []
    return booth.display.order
      .map((id) => {
        const entry = booth.works.find((e) => e.workId === id)
        const work = works.find((w) => w.id === id)
        return entry && work ? { entry, work } : null
      })
      .filter((x): x is { entry: Booth['works'][number]; work: StoredWork } => x !== null)
  }, [booth, works])

  const items = useMemo(() => (booth ? collectBoothItems(booth, works) : []), [booth, works])

  // ---------- 陈列操作 ----------
  const addWork = (workId: string) => {
    if (!booth) return
    if (booth.display.order.includes(workId)) return
    const work = works.find((w) => w.id === workId)
    const workType = work?.workType || 'interactive-narrative'
    const entry = {
      workId,
      workType,
      preview: { type: 'nodes' as const, value: 3 },
      pricing: { override: false, whole: undefined, chapter: undefined, segment: undefined },
      addedAt: Date.now(),
    }
    persist({
      ...booth,
      works: [...booth.works, entry],
      display: { ...booth.display, order: [...booth.display.order, workId] },
    })
  }

  const removeWork = (workId: string) => {
    if (!booth) return
    persist({
      ...booth,
      works: booth.works.filter((e) => e.workId !== workId),
      display: {
        order: booth.display.order.filter((id) => id !== workId),
        featuredId: booth.display.featuredId === workId ? null : booth.display.featuredId,
      },
    })
  }

  const moveWork = (index: number, dir: -1 | 1) => {
    if (!booth) return
    const order = [...booth.display.order]
    const target = index + dir
    if (target < 0 || target >= order.length) return
    ;[order[index], order[target]] = [order[target], order[index]]
    persist({ ...booth, display: { ...booth.display, order } })
  }

  const toggleFeatured = (workId: string) => {
    if (!booth) return
    const featuredId = booth.display.featuredId === workId ? null : workId
    persist({ ...booth, display: { ...booth.display, featuredId } })
  }

  const updateEntry = (workId: string, patch: Partial<Booth['works'][number]>) => {
    if (!booth) return
    persist({
      ...booth,
      works: booth.works.map((e) => (e.workId === workId ? { ...e, ...patch } : e)),
    })
  }

  // ---------- 收款方式 ----------
  const addChannel = (kind: 'manual' | 'thirdParty') => {
    if (!booth) return
    const id = `ch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    if (kind === 'manual') {
      persist({ ...booth, channels: { ...booth.channels, manual: [...booth.channels.manual, { id, kind: 'wechat', label: '', value: '' }] } })
    } else {
      persist({ ...booth, channels: { ...booth.channels, thirdParty: [...booth.channels.thirdParty, { id, kind: 'afdian', label: '', link: '' }] } })
    }
  }

  const updateChannel = (
    kind: 'manual' | 'thirdParty',
    id: string,
    patch: Record<string, string>
  ) => {
    if (!booth) return
    const list = booth.channels[kind].map((c) => (c.id === id ? { ...c, ...patch } : c))
    persist({ ...booth, channels: { ...booth.channels, [kind]: list } })
  }

  const removeChannel = (kind: 'manual' | 'thirdParty', id: string) => {
    if (!booth) return
    const list = booth.channels[kind].filter((c) => c.id !== id)
    persist({ ...booth, channels: { ...booth.channels, [kind]: list } })
  }

  // ---------- 导出与摆摊 ----------
  const handleExport = async () => {
    if (!booth) return
    const res = await saveBoothZip(booth, items)
    if (res.success) showToast('success', '摊位包已导出')
    else if (res.error && res.error !== '已取消') showToast('error', res.error)
  }

  const handlePreview = () => {
    if (!booth) return
    const html = generateBoothPreviewHTML(booth, items, booth.display.featuredId)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const [publishing, setPublishing] = useState(false)
  const handlePublish = async () => {
    if (!booth) return
    const acc = getCurrentAccount()
    if (!acc) {
      showToast('error', '请先在「创作者中心」登录创作者账号')
      return
    }
    const configs = await getPlatformConfigs().catch(() => [])
    const enabled = configs.filter((c) => c.enabled)
    if (enabled.length === 0) {
      showToast('error', '请先在「创作者中心」配置并启用发布平台')
      return
    }
    setPublishing(true)
    setPublishResult(null)
    try {
      const outcome = await publishBooth(booth, items, enabled[0].id, acc)
      setPublishResult(outcome)
      if (outcome.success) showToast('success', `已摆摊：${outcome.results.length} 件作品全部提交`)
      else showToast('error', outcome.error || '摆摊部分失败')
    } catch (err) {
      console.error('摆摊失败:', err)
      showToast('error', '摆摊失败，请稍后重试')
    } finally {
      setPublishing(false)
    }
  }

  if (loading || !booth) {
    return (
      <div className="h-screen w-screen bg-slate-900 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const sections: Array<{ id: SectionId; name: string }> = [
    { id: 'profile', name: '摊位资料' },
    { id: 'promo', name: '宣传与标签' },
    { id: 'display', name: '陈列管理' },
    { id: 'pricing', name: '试阅与价目' },
    { id: 'channels', name: '收款方式' },
  ]

  return (
    <div className="h-screen w-screen bg-slate-900 flex flex-col overflow-hidden">
      {/* 顶栏 */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/90 backdrop-blur shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Store className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-sm font-semibold text-white">摊位工作台</h1>
        </div>
        <span className={`flex items-center gap-1 text-[10px] ${saved ? 'text-slate-500' : 'text-amber-400'}`}>
          <Save className="w-3 h-3" />
          {saved ? '已保存' : '保存中…'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handlePreview}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            摊位预览
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors"
          >
            <Package className="w-3.5 h-3.5" />
            打包导出
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {publishing ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            一键摆摊
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧配置 */}
        <aside className="w-[380px] shrink-0 border-r border-slate-800 overflow-y-auto bg-slate-900/60">
          <div className="p-3 border-b border-slate-800 flex gap-1 flex-wrap">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  section === s.id
                    ? 'bg-pink-500/15 text-pink-300 border border-pink-500/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-5">
            {section === 'profile' && (
              <>
                <Field label="摊位名（作者笔名）">
                  <input
                    className={inputCls}
                    value={booth.creator.handle}
                    onChange={(e) => {
                      updateCreator({ handle: e.target.value })
                      updateBooth({ name: e.target.value || '我的摊位' })
                    }}
                    placeholder="如：阿摊"
                  />
                </Field>
                <Field label="摊位简介">
                  <textarea
                    className="w-full min-h-[84px] text-sm rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 resize-y"
                    value={booth.creator.bio}
                    onChange={(e) => updateCreator({ bio: e.target.value })}
                    placeholder="一句话介绍你的摊位与作品风格…"
                  />
                </Field>
                <Field label="联系方式（站外交易入口）">
                  <input
                    className={inputCls}
                    value={booth.creator.contact}
                    onChange={(e) => updateCreator({ contact: e.target.value })}
                    placeholder="如：微信：xxxx 或邮箱"
                  />
                </Field>
                <Field label="头像（图片 URL 或本地引用）">
                  <input
                    className={inputCls}
                    value={booth.creator.avatar || ''}
                    onChange={(e) => updateCreator({ avatar: e.target.value || null })}
                    placeholder="可留空"
                  />
                </Field>
              </>
            )}

            {section === 'promo' && (
              <>
                <Field label="摊位标语">
                  <input
                    className={inputCls}
                    value={booth.profile.slogan}
                    onChange={(e) => updateProfile({ slogan: e.target.value })}
                    placeholder="如：把有趣的故事，摆到你的面前"
                  />
                </Field>
                <Field label="摊位横幅（图片 URL）">
                  <input
                    className={inputCls}
                    value={booth.profile.banner || ''}
                    onChange={(e) => updateProfile({ banner: e.target.value || null })}
                    placeholder="可留空，使用默认横幅"
                  />
                </Field>
                <Field label="摊位标签（逗号或空格分隔）">
                  <input
                    className={inputCls}
                    value={booth.profile.tags.join('，')}
                    onChange={(e) =>
                      updateProfile({
                        tags: e.target.value
                          .split(/[,，\s]+/)
                          .map((t) => t.trim())
                          .filter(Boolean)
                          .slice(0, 8),
                      })
                    }
                    placeholder="悬疑，治愈，科幻…"
                  />
                </Field>
                <Field label="合规声明（默认即可）">
                  <textarea
                    className="w-full min-h-[72px] text-xs rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-300 focus:outline-none focus:ring-2 focus:ring-pink-500/50 resize-y"
                    value={booth.complianceNote || DEFAULT_COMPLIANCE_NOTE}
                    onChange={(e) => updateBooth({ complianceNote: e.target.value })}
                  />
                </Field>
              </>
            )}

            {section === 'display' && (
              <>
                <p className="text-xs text-slate-500 leading-relaxed">
                  把作品摆上摊位。陈列顺序即摊位展示顺序，可设一件主推作品（高亮标注）。
                </p>
                {boothWorks.map(({ entry, work }, index) => (
                  <div key={work.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-700/70 bg-slate-800/60">
                    <div className="flex flex-col">
                      <button
                        onClick={() => moveWork(index, -1)}
                        disabled={index === 0}
                        className="p-0.5 text-slate-500 hover:text-white disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveWork(index, 1)}
                        disabled={index === boothWorks.length - 1}
                        className="p-0.5 text-slate-500 hover:text-white disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => toggleFeatured(work.id)}
                      title={booth.display.featuredId === work.id ? '取消主推' : '设为主推'}
                      className={`p-1.5 rounded-md transition-colors ${
                        booth.display.featuredId === work.id
                          ? 'text-amber-400 bg-amber-500/10'
                          : 'text-slate-600 hover:text-amber-400'
                      }`}
                    >
                      <Star className="w-4 h-4" fill={booth.display.featuredId === work.id ? 'currentColor' : 'none'} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{work.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {WORK_TYPE_NAMES[entry.workType] || entry.workType}
                      </p>
                    </div>
                    <button
                      onClick={() => removeWork(work.id)}
                      className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <div className="pt-1">
                  <p className="text-xs text-slate-400 mb-2">待上架作品</p>
                  {works
                    .filter((w) => !booth.display.order.includes(w.id))
                    .map((work) => (
                      <button
                        key={work.id}
                        onClick={() => addWork(work.id)}
                        className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-dashed border-slate-700 hover:border-pink-500/50 hover:bg-slate-800/60 transition-colors text-left"
                      >
                        <Plus className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs text-slate-300 truncate">{work.name}</span>
                        <span className="ml-auto text-[10px] text-slate-600">
                          {WORK_TYPE_NAMES[work.workType || 'interactive-narrative'] || work.workType}
                        </span>
                      </button>
                    ))}
                  {works.length === 0 && (
                    <p className="text-xs text-slate-600 mt-2">还没有作品，先去创作模式做一本本子吧。</p>
                  )}
                </div>
              </>
            )}

            {section === 'pricing' && (
              <>
                <p className="text-xs text-slate-500 leading-relaxed">
                  为每件陈列作品配置试阅片段与价目。试阅片段是发布到展示墙的宣传物料，完整内容不托管在平台。
                </p>
                {boothWorks.length === 0 && (
                  <p className="text-xs text-slate-600">先在「陈列管理」摆上作品。</p>
                )}
                {boothWorks.map(({ entry, work }) => (
                  <div key={work.id} className="p-3 rounded-lg border border-slate-700/70 bg-slate-800/60 space-y-3">
                    <p className="text-xs font-medium text-white truncate">{work.name}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className={labelCls}>试阅类型</span>
                        <select
                          className={inputCls}
                          value={entry.preview.type}
                          onChange={(e) =>
                            updateEntry(work.id, {
                              preview: {
                                ...entry.preview,
                                type: e.target.value as Booth['works'][number]['preview']['type'],
                              },
                            })
                          }
                        >
                          {PREVIEW_TYPES.map((t) => (
                            <option key={t.id} value={t.id}>
                              前 N {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <span className={labelCls}>试阅数量</span>
                        <input
                          type="number"
                          min={0}
                          className={inputCls}
                          value={entry.preview.value}
                          onChange={(e) =>
                            updateEntry(work.id, {
                              preview: {
                                ...entry.preview,
                                value: Math.max(0, Number(e.target.value) || 0),
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={entry.pricing.override}
                        onChange={(e) =>
                          updateEntry(work.id, {
                            pricing: { ...entry.pricing, override: e.target.checked },
                          })
                        }
                        className="accent-pink-500"
                      />
                      覆盖作品默认价目
                    </label>
                    {entry.pricing.override && (
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            ['whole', '整本 ¥'],
                            ['chapter', '章节 ¥'],
                            ['segment', '片段 ¥'],
                          ] as const
                        ).map(([key, ph]) => (
                          <div key={key}>
                            <span className={labelCls}>{ph}</span>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              className={inputCls}
                              value={entry.pricing[key] ?? ''}
                              placeholder="0"
                              onChange={(e) =>
                                updateEntry(work.id, {
                                  pricing: {
                                    ...entry.pricing,
                                    [key]: e.target.value ? Number(e.target.value) : undefined,
                                  },
                                })
                              }
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {section === 'channels' && (
              <>
                <p className="text-xs text-slate-500 leading-relaxed">
                  聚合多渠道收款方式，展示在摊位预览与摊位页上。支付直达创作者，平台零参与。
                </p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">收款码 / 账号</span>
                    <button
                      onClick={() => addChannel('manual')}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] text-pink-300 hover:bg-pink-500/10 rounded-md transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      添加
                    </button>
                  </div>
                  {booth.channels.manual.map((c) => (
                    <div key={c.id} className="p-2.5 rounded-lg border border-slate-700/70 bg-slate-800/60 space-y-2">
                      <div className="flex gap-2">
                        <select
                          className={`${inputCls} flex-1`}
                          value={c.kind}
                          onChange={(e) => updateChannel('manual', c.id, { kind: e.target.value })}
                        >
                          {MANUAL_KINDS.map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeChannel('manual', c.id)}
                          className="p-1.5 text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input
                        className={`${inputCls} h-8 text-xs`}
                        value={c.label}
                        onChange={(e) => updateChannel('manual', c.id, { label: e.target.value })}
                        placeholder="展示名（可选）"
                      />
                      <input
                        className={`${inputCls} h-8 text-xs`}
                        value={c.value}
                        onChange={(e) => updateChannel('manual', c.id, { value: e.target.value })}
                        placeholder="收款码/账号信息"
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">第三方平台链接</span>
                    <button
                      onClick={() => addChannel('thirdParty')}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] text-pink-300 hover:bg-pink-500/10 rounded-md transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      添加
                    </button>
                  </div>
                  {booth.channels.thirdParty.map((c) => (
                    <div key={c.id} className="p-2.5 rounded-lg border border-slate-700/70 bg-slate-800/60 space-y-2">
                      <div className="flex gap-2">
                        <select
                          className={`${inputCls} flex-1`}
                          value={c.kind}
                          onChange={(e) => updateChannel('thirdParty', c.id, { kind: e.target.value })}
                        >
                          {THIRD_KINDS.map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeChannel('thirdParty', c.id)}
                          className="p-1.5 text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input
                        className={`${inputCls} h-8 text-xs`}
                        value={c.label}
                        onChange={(e) => updateChannel('thirdParty', c.id, { label: e.target.value })}
                        placeholder="展示名（可选）"
                      />
                      <input
                        className={`${inputCls} h-8 text-xs`}
                        value={c.link}
                        onChange={(e) => updateChannel('thirdParty', c.id, { link: e.target.value })}
                        placeholder="https://…"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </aside>

        {/* 右侧摊位预览 */}
        <main className="flex-1 overflow-y-auto p-6">
          <BoothPreview booth={booth} boothWorks={boothWorks} publishResult={publishResult} />
        </main>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      {children}
    </div>
  )
}

function previewLabel(entry: Booth['works'][number]): string {
  const v = Math.max(0, entry.preview.value)
  switch (entry.preview.type) {
    case 'chapters':
      return `试阅前 ${v} 章`
    case 'seconds':
      return `试看前 ${v} 秒`
    case 'nodes':
      return `试玩前 ${v} 个节点`
    case 'panels':
      return `试阅前 ${v} 格`
  }
}

function pricingLabel(entry: Booth['works'][number]): string {
  const p = entry.pricing
  if (!p.override) return '按作品定价'
  const parts: string[] = []
  if (p.whole && p.whole > 0) parts.push(`整本 ¥${p.whole}`)
  if (p.chapter && p.chapter > 0) parts.push(`章节 ¥${p.chapter}`)
  if (p.segment && p.segment > 0) parts.push(`片段 ¥${p.segment}`)
  return parts.length ? parts.join(' / ') : '免费'
}

function BoothPreview({
  booth,
  boothWorks,
  publishResult,
}: {
  booth: Booth
  boothWorks: Array<{ entry: Booth['works'][number]; work: StoredWork }>
  publishResult: BoothPublishOutcome | null
}) {
  const doc = (work: StoredWork) => getDocumentFromWork(work)

  return (
    <div className="max-w-3xl mx-auto">
      {/* 摊位横幅 */}
      <div
        className="relative rounded-2xl overflow-hidden border border-slate-700 mb-5"
        style={{
          background:
            'linear-gradient(135deg, hsl(35 70% 50% / 0.28), transparent 45%, hsl(210 80% 50% / 0.22))',
        }}
      >
        {booth.profile.banner && (
          <img
            src={booth.profile.banner}
            alt="摊位横幅"
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
        )}
        <div className="relative p-6 sm:p-8">
          <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white mb-3">
            <Store className="w-3 h-3" />
            创作者摊位
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 break-words">
            {booth.creator.handle || '我的摊位'}
          </h2>
          {booth.profile.slogan && <p className="text-sm text-slate-300">{booth.profile.slogan}</p>}
          {booth.profile.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {booth.profile.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-200 border border-white/10"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          {booth.creator.bio && (
            <p className="text-xs text-slate-400 mt-3 leading-relaxed max-w-xl">{booth.creator.bio}</p>
          )}
        </div>
      </div>

      {/* 陈列作品 */}
      <section className="mb-5">
        <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
          <BookOpenText className="w-4 h-4 text-amber-400" />
          陈列作品
          <span className="text-[10px] text-slate-500 font-normal">{boothWorks.length} 件</span>
        </h3>
        {boothWorks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-xs text-slate-600">
            摊位上还没有陈列作品
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {boothWorks.map(({ entry, work }) => {
              const isFeatured = booth.display.featuredId === work.id
              const cover = doc(work).meta?.coverImage || work.thumbnail
              return (
                <div
                  key={work.id}
                  className={`rounded-xl overflow-hidden border bg-slate-800/60 ${
                    isFeatured ? 'border-amber-500/60 ring-1 ring-amber-500/30' : 'border-slate-700/70'
                  }`}
                >
                  <div className="h-28 bg-gradient-to-br from-slate-700 to-slate-800 relative">
                    {cover ? (
                      <img src={cover} alt={work.name} className="w-full h-full object-cover" />
                    ) : null}
                    {isFeatured && (
                      <span className="absolute top-2 left-2 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-white">
                        <Star className="w-3 h-3" fill="currentColor" />
                        主推
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-medium text-white truncate">{work.name}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {WORK_TYPE_NAMES[entry.workType] || entry.workType} · {previewLabel(entry)} ·{' '}
                      {pricingLabel(entry)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 收款方式 */}
      {(booth.channels.manual.length > 0 || booth.channels.thirdParty.length > 0) && (
        <section className="mb-5">
          <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-pink-400" />
            收款方式
          </h3>
          <div className="flex flex-wrap gap-2">
            {booth.channels.manual
              .filter((c) => c.value.trim())
              .map((c) => (
                <span key={c.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] text-slate-300">
                  {c.label || c.kind}
                  <span className="text-slate-500">{c.value}</span>
                </span>
              ))}
            {booth.channels.thirdParty
              .filter((c) => c.link.trim())
              .map((c) => (
                <a
                  key={c.id}
                  href={c.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] text-slate-300 hover:border-pink-500/50 transition-colors"
                >
                  {c.label || c.kind}
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              ))}
          </div>
        </section>
      )}

      {/* 联系 */}
      {booth.creator.contact.trim() && (
        <section className="mb-5">
          <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-sky-400" />
            联系创作者
          </h3>
          <p className="text-xs text-slate-300 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700">
            {booth.creator.contact}
          </p>
        </section>
      )}

      {/* 摆摊结果 */}
      {publishResult && (
        <section className="mb-5 rounded-xl border p-3 space-y-1.5 bg-slate-800/60 border-slate-700">
          <p className={`text-xs font-medium ${publishResult.success ? 'text-emerald-400' : 'text-amber-400'}`}>
            {publishResult.success ? '摆摊完成：全部作品已提交到展示墙' : '摆摊结果（部分失败）'}
          </p>
          {publishResult.results.map((r) => (
            <div key={r.workId} className="flex items-center gap-2 text-[11px]">
              <span className={r.success ? 'text-emerald-400' : 'text-red-400'}>
                {r.success ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
              </span>
              <span className="text-slate-300 truncate">{r.title}</span>
              {!r.success && <span className="text-red-400/80 truncate ml-auto">{r.error}</span>}
            </div>
          ))}
        </section>
      )}

      {/* 合规声明 */}
      <p className="text-center text-[10px] text-slate-600 leading-relaxed px-4 pb-2">
        {booth.complianceNote || DEFAULT_COMPLIANCE_NOTE}
      </p>
    </div>
  )
}

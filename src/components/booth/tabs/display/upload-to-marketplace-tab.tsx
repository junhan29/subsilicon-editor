/** B3b. 上传到自由集市 Tab（发布表单 + 新增 downloadLinks 编辑器） */
import React, { useMemo, useState } from 'react'
import { AlertTriangle, Loader2, CheckCircle2, Send, Upload, Image as ImageIcon } from 'lucide-react'
import type { Booth, BoothWorkEntry } from '@editor/lib/booth/types'
import type { StoredWork } from '@editor/lib/local-db/work-store'
import type { PlatformConfig } from '@editor/types/creator'
import { getPlatformConfigs, publishToPlatform, validateDownloadLinks, type DownloadLink } from '@editor/lib/creator-service'
import type { LocalAccount } from '@editor/lib/local-account-store'
import { DownloadLinksEditor } from '../../shared/download-links-editor'
import { showToast } from '@editor/components/editor/toast'

const inputCls =
  'w-full h-9 text-sm rounded-lg border border-border bg-secondary px-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50'
const taCls =
  'w-full text-sm rounded-lg border border-border bg-secondary px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y min-h-[80px]'
const labelCls = 'block text-xs text-muted-foreground mb-1'

export interface UploadToMarketplaceTabProps {
  booth: Booth
  works: StoredWork[]
  account: Omit<LocalAccount, 'passwordHash'> | null
  highlightDownloadLinks?: boolean
}

export function UploadToMarketplaceTab({
  booth,
  works,
  account,
  highlightDownloadLinks = false,
}: UploadToMarketplaceTabProps) {
  const [platformId, setPlatformId] = useState<string>('')
  const [platforms, setPlatforms] = useState<PlatformConfig[]>([])
  const [platformsLoaded, setPlatformsLoaded] = useState(false)

  // 预选择作品：若陈列已有第 0 件，默认选它
  const [selWorkId, setSelWorkId] = useState<string>(booth.display.order[0] || works[0]?.id || '')

  // 表单字段
  const [authorBio, setAuthorBio] = useState(booth.creator.bio)
  const [contact, setContact] = useState(booth.creator.contact)
  const [extLink, setExtLink] = useState(booth.channels.thirdParty[0]?.link ?? '')
  const [tagInput, setTagInput] = useState((booth.profile.tags || []).join('，'))
  const [summary, setSummary] = useState('')
  const [title, setTitle] = useState('')

  // 封面 + 截图（简化：直接复用 CreatorCenterDialog 中的 file refs 思路）
  const [coverPreview, setCoverPreview] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [shots, setShots] = useState<{ file: File; preview: string }[]>([])

  const [downloadLinks, setDownloadLinks] = useState<DownloadLink[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // 加载平台配置
  const loadPlatforms = async () => {
    if (platformsLoaded) return
    if (!account) return
    try {
      const list = await getPlatformConfigs(account.email)
      const enabled = list.filter((p) => p.enabled)
      setPlatforms(enabled)
      if (enabled.length > 0 && !platformId) setPlatformId(enabled[0].id)
    } catch { /* ignore */ }
    setPlatformsLoaded(true)
  }
  void loadPlatforms()

  const tags = useMemo(
    () =>
      tagInput
        .split(/[,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 5),
    [tagInput]
  )

  const pickCover = async (f: File) => {
    setCoverFile(f)
    setCoverPreview(URL.createObjectURL(f))
  }
  const addShots = async (files: FileList | null) => {
    if (!files) return
    const arr = Array.from(files).slice(0, 6 - shots.length)
    const mapped: { file: File; preview: string }[] = arr.map((f) => ({
      file: f,
      preview: URL.createObjectURL(f),
    }))
    setShots((s) => s.concat(mapped).slice(0, 6))
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!account) e.account = '请先登录创作身份（顶栏右侧 → 生成创作令牌）'
    if (!platformId) e.platform = '请先在创作者中心配置并启用发布平台'
    if (!selWorkId) e.work = '请选择要上传的作品'
    if (!title.trim()) e.title = '请填写作品标题'
    else if ([...title].length > 60) e.title = '标题 ≤60 字'
    if ([...summary].length > 100) e.summary = '简介 ≤100 字'
    const dl = validateDownloadLinks(downloadLinks, { allowEmpty: true })
    if (!dl.ok) e.downloadLinks = dl.error || '下载渠道校验失败'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async () => {
    if (!validate() || !account) {
      const keys = Object.keys(errors)
      if (keys[0]) showToast('error', errors[keys[0]])
      return
    }
    setSubmitting(true)
    setResult(null)
    try {
      const extra: Record<string, string> = {}
      // D3. downloadLinks 字段：JSON 字符串传入 extraFields → FormData.append
      if (downloadLinks.length > 0) {
        const v = validateDownloadLinks(downloadLinks, { allowEmpty: true })
        if (!v.ok || !v.value) throw new Error('下载渠道校验失败：' + (v.error || 'unknown'))
        extra.downloadLinks = JSON.stringify(v.value)
      }
      const res = await publishToPlatform(
        selWorkId,
        platformId,
        title,
        summary,
        tags,
        coverFile,
        shots,
        contact,
        extLink,
        '',
        account,
        extra
      )
      if (res.success) {
        setResult({ ok: true, msg: '已提交到自由集市，等待审核。' })
        showToast('success', '提交成功，等待审核')
      } else {
        setResult({ ok: false, msg: res.error || '提交失败' })
        showToast('error', res.error || '提交失败')
      }
    } catch (e: any) {
      const m = e?.message || String(e)
      setResult({ ok: false, msg: m })
      showToast('error', m)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-white mb-1">上传到自由集市</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          填写作品资料与下载渠道，一键提交到 SubSilicon 自由集市。审核通过后即可公开展示。
        </p>
      </div>

      {result && (
        <div
          className={
            'flex items-start gap-2 px-3 py-2.5 rounded-lg border text-xs ' +
            (result.ok
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-primary/10 border-primary/30 text-red-300')
          }
        >
          {result.ok ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
          )}
          <span>{result.msg}</span>
        </div>
      )}

      {/* 作品选择 */}
      <section className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
        <div>
          <span className={labelCls}>选择作品 *</span>
          <select
            className={inputCls}
            value={selWorkId}
            onChange={(e) => setSelWorkId(e.target.value)}
          >
            <option value="">-- 请选择陈列作品 --</option>
            {works.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          {errors.work && (
            <p className="mt-1 text-[11px] text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {errors.work}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className={labelCls}>作品标题 *</span>
            <input
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="≤ 60 字"
              maxLength={80}
            />
            {errors.title && (
              <p className="mt-1 text-[11px] text-red-400">{errors.title}</p>
            )}
          </div>
          <div>
            <span className={labelCls}>标签（逗号分隔，≤5）</span>
            <input
              className={inputCls}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="悬疑，治愈…"
            />
          </div>
        </div>

        <div>
          <span className={labelCls}>作品简介（≤100 字）</span>
          <textarea
            className={taCls}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="吸引人的短简介，展示在集市列表与详情页"
            rows={3}
          />
        </div>
      </section>

      {/* 作者 & 联系 */}
      <section className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
        <h4 className="text-sm font-medium text-white">作者信息</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className={labelCls}>作者简介</span>
            <input
              className={inputCls}
              value={authorBio}
              onChange={(e) => setAuthorBio(e.target.value)}
            />
          </div>
          <div>
            <span className={labelCls}>联系信息 / 收款入口</span>
            <input
              className={inputCls}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="微信 / 邮箱 / QQ 等"
            />
          </div>
        </div>
        <div>
          <span className={labelCls}>外链（爱发电 / 个人网站等）</span>
          <input
            className={inputCls}
            value={extLink}
            onChange={(e) => setExtLink(e.target.value)}
            placeholder="https://…"
          />
        </div>
      </section>

      {/* 封面 / 截图 */}
      <section className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
        <h4 className="text-sm font-medium text-white">封面与截图</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className={labelCls}>封面图</span>
            <label className="flex items-center gap-2 border border-dashed border-border hover:border-primary/40 rounded-lg p-3 cursor-pointer transition-colors">
              <Upload className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">点击选择封面…</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void pickCover(f)
                }}
              />
            </label>
            {coverPreview && (
              <img src={coverPreview} className="mt-2 h-20 rounded border border-border object-cover" />
            )}
          </div>
          <div>
            <span className={labelCls}>截图（≤6）</span>
            <label className="flex items-center gap-2 border border-dashed border-border hover:border-primary/40 rounded-lg p-3 cursor-pointer transition-colors">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                选择截图… ({shots.length}/6)
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void addShots(e.target.files)}
              />
            </label>
            {shots.length > 0 && (
              <div className="mt-2 flex gap-1.5 flex-wrap">
                {shots.map((s, i) => (
                  <div key={i} className="relative">
                    <img src={s.preview} className="h-14 w-14 rounded border border-border object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 下载渠道配置 */}
      <DownloadLinksEditor
        value={downloadLinks}
        onChange={setDownloadLinks}
        flashHighlight={highlightDownloadLinks}
        disabled={submitting}
      />
      {errors.downloadLinks && (
        <p className="px-1 text-[11px] text-red-400 flex items-center gap-1 -mt-2">
          <AlertTriangle className="w-3 h-3" /> {errors.downloadLinks}
        </p>
      )}

      {/* 平台选择 + 提交 */}
      <section className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className={labelCls}>发布平台 *</span>
            <select
              className={inputCls}
              value={platformId}
              onChange={(e) => setPlatformId(e.target.value)}
            >
              <option value="">-- 请选择平台 --</option>
              {platforms.length === 0 && (
                <option value="" disabled>
                  （请先到创作者中心添加发布平台）
                </option>
              )}
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <span className="text-[11px] text-muted-foreground leading-relaxed">
              下载渠道将以 JSON 字符串作为 <code>downloadLinks</code> 字段提交到站点端{' '}
              <code>/submit</code> 端点，与网站端校验对齐。
            </span>
          </div>
        </div>
        {errors.account && (
          <p className="text-[11px] text-red-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {errors.account}
          </p>
        )}
        {errors.platform && (
          <p className="text-[11px] text-red-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {errors.platform}
          </p>
        )}

        <div className="pt-1 flex justify-end">
          <button
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            提交到自由集市
          </button>
        </div>
      </section>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Upload,
  X,
  Tag,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
} from 'lucide-react'
import type { StoryGraph } from '@editor/types/editor'
import { getAccount, isLoggedIn } from '@editor/lib/local-account-store'
import {
  listProviders,
  getActiveProvider,
  setActiveProvider,
  addProvider,
  removeProvider,
  subscribe,
  type SubmitProvider,
} from '@editor/lib/submit-providers'
import { exportPreviewHTML } from '@editor/lib/export-preview-html'
import { showToast } from './toast'
import { AccountDialog } from './account-dialog'

interface DirectoryUploadDialogProps {
  open: boolean
  onClose: () => void
  graph: StoryGraph
  workId?: string
}

const PRESET_TAGS = ['古风', '悬疑', '科幻', '恋爱', '恐怖', '冒险', '治愈', '搞笑']

const MAX_COVER_SIZE = 2 * 1024 * 1024
const MAX_SUMMARY_LENGTH = 100
const MAX_SCREENSHOTS = 6
const MAX_SCREENSHOT_SIZE = 2 * 1024 * 1024

export function DirectoryUploadDialog({
  open,
  onClose,
  graph,
  workId,
}: DirectoryUploadDialogProps) {
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [customTagInput, setCustomTagInput] = useState('')
  const [creatorName, setCreatorName] = useState('')
  const [wechat, setWechat] = useState('')
  const [afdianLink, setAfdianLink] = useState('')
  const [coverImage, setCoverImage] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState('')
  const [screenshots, setScreenshots] = useState<{ file: File; preview: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showAccountDialog, setShowAccountDialog] = useState(false)
  const [providers, setProviders] = useState<SubmitProvider[]>(() => listProviders())
  const [activeProvider, setActiveProviderState] = useState<SubmitProvider>(() => getActiveProvider())
  const [showAddProvider, setShowAddProvider] = useState(false)
  const [newProvider, setNewProvider] = useState({ name: '', apiUrl: '', authToken: '', description: '' })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const screenshotsInputRef = useRef<HTMLInputElement>(null)

  const account = getAccount()
  const loggedIn = isLoggedIn()

  useEffect(() => {
    const unsub = subscribe(() => {
      setProviders(listProviders())
      setActiveProviderState(getActiveProvider())
    })
    return unsub
  }, [])

  useEffect(() => {
    if (open) {
      setTitle(graph.title || '')
      setSummary('')
      setTags([])
      setCustomTagInput('')
      setCreatorName('')
      setWechat('')
      setAfdianLink('')
      setCoverImage(null)
      setCoverPreview('')
      setScreenshots([])
      setSubmitted(false)
      setErrors({})
    }
  }, [open, graph])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, submitting, onClose])

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const addCustomTag = () => {
    const trimmed = customTagInput.trim()
    if (!trimmed) return
    if (tags.includes(trimmed)) {
      setCustomTagInput('')
      return
    }
    setTags((prev) => [...prev, trimmed])
    setCustomTagInput('')
  }

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('error', '请上传图片格式的文件')
      return
    }
    if (file.size > MAX_COVER_SIZE) {
      showToast('error', '封面图大小不能超过 2MB')
      return
    }
    setCoverImage(file)
    const reader = new FileReader()
    reader.onload = () => setCoverPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const clearCover = () => {
    setCoverImage(null)
    setCoverPreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleScreenshotsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const remainingSlots = MAX_SCREENSHOTS - screenshots.length
    const filesToAdd = Array.from(files).slice(0, remainingSlots)

    if (filesToAdd.length === 0) {
      showToast('error', `最多只能上传 ${MAX_SCREENSHOTS} 张截图`)
      return
    }

    filesToAdd.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        showToast('error', '请上传图片格式的文件')
        return
      }
      if (file.size > MAX_SCREENSHOT_SIZE) {
        showToast('error', '截图大小不能超过 2MB')
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        setScreenshots((prev) => [...prev, { file, preview: reader.result as string }])
      }
      reader.readAsDataURL(file)
    })

    if (screenshotsInputRef.current) screenshotsInputRef.current.value = ''
  }

  const removeScreenshot = (index: number) => {
    setScreenshots((prev) => prev.filter((_, i) => i !== index))
  }

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!title.trim()) next.title = '请填写作品标题'
    if (!summary.trim()) next.summary = '请填写一句话简介'
    if (summary.length > MAX_SUMMARY_LENGTH) next.summary = `简介不能超过 ${MAX_SUMMARY_LENGTH} 字`
    const hasContact = wechat.trim() || afdianLink.trim()
    if (!hasContact) next.contact = '请至少填写微信号或爱发电链接之一'
    if (afdianLink.trim() && !/^https?:\/\/.+/.test(afdianLink.trim())) {
      next.afdianLink = '爱发电链接格式不正确'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = useCallback(async () => {
    if (submitting) return
    if (!validate()) return
    const currentAccount = getAccount()
    if (!currentAccount) {
      showToast('error', '请先注册/登录账号')
      return
    }

    setSubmitting(true)
    try {
      const previewHtml = exportPreviewHTML(graph)
      const previewBlob = new Blob([previewHtml], { type: 'text/html;charset=utf-8' })

      const formData = new FormData()
      formData.append('creatorEmail', currentAccount.email)
      formData.append('creatorName', currentAccount.displayName)
      formData.append('creatorBio', currentAccount.bio || '')
      formData.append('title', title.trim())
      formData.append('summary', summary.trim())
      formData.append('tags', JSON.stringify(tags))
      if (coverImage) formData.append('coverImage', coverImage)
      screenshots.forEach((s, i) => {
        formData.append(`screenshot-${i}`, s.file)
      })
      formData.append('contactInfo', wechat.trim())
      formData.append('externalLink', afdianLink.trim())
      formData.append('previewHtml', previewBlob, 'preview.html')
      if (workId) formData.append('workId', workId)

      const res = await fetch(activeProvider.apiUrl, {
        method: 'POST',
        headers: {
          [activeProvider.authHeader || 'X-Submit-Token']: activeProvider.authToken || '',
        },
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || `服务器响应异常（${res.status}）`)
      }

      setSubmitted(true)
      showToast('success', `上传成功，审核通过后将在 ${activeProvider.name} 展示`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast('error', `提交失败：${msg}`)
    } finally {
      setSubmitting(false)
    }
  }, [submitting, title, summary, tags, wechat, afdianLink, coverImage, graph, workId])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Upload className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-100">上传作品到展示墙</h3>
              <p className="text-[10px] text-slate-400">展示你的作品给更多读者</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="关闭"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 flex-1">
          {!loggedIn && (
            <div className="mb-5 p-4 rounded-xl border border-blue-700/50 bg-blue-900/20">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-sm font-medium text-blue-200">
                    请先注册/登录账号
                  </div>
                  <p className="text-[12px] text-blue-300/80 leading-relaxed">
                    首次使用请先注册账号，已有账号请登录。登录后即可上传作品到所选展示墙。
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => setShowAccountDialog(true)}
                      className="px-3 py-1 text-xs rounded-lg bg-blue-500 hover:bg-blue-400 text-white"
                    >
                      注册 / 登录
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {submitted && (
            <div className="mb-5 p-4 rounded-xl border border-emerald-700/50 bg-emerald-900/20">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-sm font-medium text-emerald-200">提交成功</div>
                  <p className="text-[12px] text-emerald-300/80 leading-relaxed">
                    审核通过后将在 {activeProvider.name} 展示，请耐心等待。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 提交目标选择：支持任意实现了公共提交协议的作品墙 */}
          <div className="mb-5 p-4 rounded-xl border border-slate-700 bg-slate-800/40">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-300">提交到</label>
              <button
                type="button"
                onClick={() => setShowAddProvider(s => !s)}
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                添加展示墙
              </button>
            </div>
            <select
              value={activeProvider.id}
              onChange={(e) => setActiveProvider(e.target.value)}
              disabled={submitting}
              className="w-full px-2.5 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500/60"
            >
              {providers.filter(p => p.enabled).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {activeProvider.description && (
              <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed">{activeProvider.description}</p>
            )}

            {showAddProvider && (
              <div className="mt-3 pt-3 border-t border-slate-700 space-y-2">
                <input
                  type="text"
                  value={newProvider.name}
                  onChange={(e) => setNewProvider(s => ({ ...s, name: e.target.value }))}
                  placeholder="展示墙名称（如：我的个人站）"
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                />
                <input
                  type="url"
                  value={newProvider.apiUrl}
                  onChange={(e) => setNewProvider(s => ({ ...s, apiUrl: e.target.value }))}
                  placeholder="提交端点 URL（https://...）"
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                />
                <input
                  type="text"
                  value={newProvider.authToken}
                  onChange={(e) => setNewProvider(s => ({ ...s, authToken: e.target.value }))}
                  placeholder="提交令牌（可选）"
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                />
                <input
                  type="text"
                  value={newProvider.description}
                  onChange={(e) => setNewProvider(s => ({ ...s, description: e.target.value }))}
                  placeholder="简短描述（可选）"
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!newProvider.name.trim() || !newProvider.apiUrl.trim()) {
                        showToast('error', '请填写名称和端点 URL')
                        return
                      }
                      try {
                        addProvider({
                          name: newProvider.name.trim(),
                          apiUrl: newProvider.apiUrl.trim(),
                          authToken: newProvider.authToken.trim() || undefined,
                          description: newProvider.description.trim() || undefined,
                          enabled: true,
                        })
                        setNewProvider({ name: '', apiUrl: '', authToken: '', description: '' })
                        setShowAddProvider(false)
                        showToast('success', '已添加展示墙')
                      } catch (err) {
                        showToast('error', err instanceof Error ? err.message : '添加失败')
                      }
                    }}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddProvider(false)}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {!activeProvider.builtin && (
              <button
                type="button"
                onClick={() => {
                  removeProvider(activeProvider.id)
                  showToast('info', '已移除该展示墙')
                }}
                disabled={submitting}
                className="mt-2 text-[11px] text-red-400 hover:text-red-300"
              >
                移除此展示墙
              </button>
            )}
          </div>

          <div className={`space-y-4 ${!loggedIn ? 'opacity-50 pointer-events-none' : ''}`}>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                作品标题 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="请输入作品标题"
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
              />
              {errors.title && (
                <p className="mt-1 text-[11px] text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.title}
                </p>
              )}
            </div>

            <div>
              <label className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  一句话简介 <span className="text-red-400">*</span>
                </span>
                <span className={`text-[10px] ${summary.length > MAX_SUMMARY_LENGTH ? 'text-red-400' : 'text-slate-500'}`}>
                  {summary.length}/{MAX_SUMMARY_LENGTH}
                </span>
              </label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value.slice(0, MAX_SUMMARY_LENGTH))}
                placeholder="用一句话介绍你的作品"
                rows={2}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 resize-none"
              />
              {errors.summary && (
                <p className="mt-1 text-[11px] text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.summary}
                </p>
              )}
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                <Tag className="w-3.5 h-3.5" />
                分类标签
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {PRESET_TAGS.map((tag) => {
                  const active = tags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                        active
                          ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                          : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
                {tags
                  .filter((t) => !PRESET_TAGS.includes(t))
                  .map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border border-amber-500 bg-amber-500/15 text-amber-300"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className="hover:text-amber-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCustomTag()
                    }
                  }}
                  placeholder="自定义标签，回车添加"
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                />
                <button
                  type="button"
                  onClick={addCustomTag}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  添加
                </button>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                联系方式 <span className="text-red-400">*</span>
                <span className="text-[10px] text-slate-500 font-normal">至少填写一项</span>
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={wechat}
                  onChange={(e) => setWechat(e.target.value)}
                  placeholder="微信号"
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
                />
                <input
                  type="url"
                  value={afdianLink}
                  onChange={(e) => setAfdianLink(e.target.value)}
                  placeholder="爱发电链接（https://...）"
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
                />
                {errors.afdianLink && (
                  <p className="text-[11px] text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.afdianLink}
                  </p>
                )}
              </div>
              {errors.contact && (
                <p className="mt-1 text-[11px] text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.contact}
                </p>
              )}
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                封面图
                <span className="text-[10px] text-slate-500 font-normal">可选，最大 2MB</span>
              </label>
              {coverPreview ? (
                <div className="relative w-full max-w-[200px] rounded-lg overflow-hidden border border-slate-700">
                  <img src={coverPreview} alt="封面预览" className="w-full h-auto" />
                  <button
                    type="button"
                    onClick={clearCover}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 hover:bg-black/90 flex items-center justify-center text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-6 rounded-lg border border-dashed border-slate-700 bg-slate-800/50 hover:border-amber-500/50 hover:bg-slate-800 flex flex-col items-center gap-1.5 transition-colors"
                >
                  <ImageIcon className="w-6 h-6 text-slate-500" />
                  <span className="text-xs text-slate-400">点击上传封面图</span>
                  <span className="text-[10px] text-slate-600">支持 JPG / PNG / WebP，最大 2MB</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverChange}
                className="hidden"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                作品截图
                <span className="text-[10px] text-slate-500 font-normal">可选，最多 {MAX_SCREENSHOTS} 张，每张最大 2MB</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {screenshots.map((s, index) => (
                  <div key={index} className="relative aspect-video rounded-lg overflow-hidden border border-slate-700">
                    <img src={s.preview} alt={`截图 ${index + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeScreenshot(index)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-black/90 flex items-center justify-center text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {screenshots.length < MAX_SCREENSHOTS && (
                  <button
                    type="button"
                    onClick={() => screenshotsInputRef.current?.click()}
                    className="aspect-video rounded-lg border border-dashed border-slate-700 bg-slate-800/50 hover:border-amber-500/50 hover:bg-slate-800 flex flex-col items-center justify-center gap-1 transition-colors"
                  >
                    <Plus className="w-5 h-5 text-slate-500" />
                    <span className="text-[10px] text-slate-500">添加截图</span>
                  </button>
                )}
              </div>
              <input
                ref={screenshotsInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleScreenshotsChange}
                className="hidden"
              />
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-700 bg-slate-900/80 shrink-0">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-1.5 text-sm rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitted ? '关闭' : '取消'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !loggedIn || submitted}
              className="px-3.5 py-1.5 text-sm rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium shadow-lg shadow-amber-500/20 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  提交中...
                </>
              ) : submitted ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  已提交
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  提交审核
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <AccountDialog
        open={showAccountDialog}
        onClose={() => setShowAccountDialog(false)}
        onSuccess={() => {
          window.location.reload()
        }}
      />
    </div>
  )
}

'use client'

import { useState } from 'react'
import { X, Loader2, Mail, Lock, User, AlertCircle, CheckCircle2 } from 'lucide-react'
import { register, login, getAccount, logout } from '@editor/lib/local-account-store'
import { showToast } from './toast'

interface AccountDialogProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

type Tab = 'login' | 'register'

export function AccountDialog({ open, onClose, onSuccess }: AccountDialogProps) {
  const [tab, setTab] = useState<Tab>('login')

  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [regDisplayName, setRegDisplayName] = useState('')
  const [regBio, setRegBio] = useState('')

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const currentAccount = getAccount()

  const handleRegister = async () => {
    setError('')

    if (!regEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) {
      setError('请输入正确的邮箱地址')
      return
    }
    if (regPassword.length < 8) {
      setError('密码至少 8 位')
      return
    }
    if (!/[a-zA-Z]/.test(regPassword) || !/[0-9]/.test(regPassword)) {
      setError('密码必须包含字母和数字')
      return
    }
    if (regPassword !== regConfirm) {
      setError('两次密码不一致')
      return
    }
    if (!regDisplayName.trim()) {
      setError('请输入显示名称')
      return
    }

    setSubmitting(true)
    try {
      const result = await register(regEmail, regPassword, regDisplayName, regBio)
      if (!result.success) {
        setError(result.error || '注册失败')
        return
      }
      showToast('success', '注册成功！')
      onSuccess?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '注册失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogin = async () => {
    setError('')

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError('请填写邮箱和密码')
      return
    }

    setSubmitting(true)
    try {
      const result = await login(loginEmail, loginPassword)
      if (!result.success) {
        setError(result.error || '登录失败')
        return
      }
      showToast('success', `欢迎回来，${result.account?.displayName || ''}`)
      onSuccess?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = () => {
    logout()
    showToast('info', '已退出登录')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-sm">账号</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center transition-colors"
            aria-label="关闭"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="px-5 py-4">
          {currentAccount ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-100 truncate">
                    {currentAccount.displayName}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{currentAccount.email}</div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              </div>
              {currentAccount.bio && (
                <p className="text-xs text-slate-400">{currentAccount.bio}</p>
              )}
              <p className="text-xs text-slate-500">
                每账号限上传 2 个作品到 SubSilicon 作品墙展示
              </p>
              <button
                onClick={() => {
                  handleLogout()
                  onClose()
                }}
                className="w-full rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm py-2 transition-colors"
              >
                退出登录
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex rounded-lg border border-slate-700 overflow-hidden">
                <button
                  onClick={() => { setTab('login'); setError('') }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    tab === 'login'
                      ? 'bg-slate-800 text-white'
                      : 'bg-transparent text-slate-400 hover:text-slate-300'
                  }`}
                >
                  登录
                </button>
                <button
                  onClick={() => { setTab('register'); setError('') }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    tab === 'register'
                      ? 'bg-slate-800 text-white'
                      : 'bg-transparent text-slate-400 hover:text-slate-300'
                  }`}
                >
                  注册
                </button>
              </div>

              {tab === 'login' ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="邮箱"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      placeholder="密码"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                    />
                  </div>
                  <button
                    onClick={handleLogin}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-900 font-medium text-sm py-2.5 transition-colors"
                  >
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />登录中...</>
                    ) : '登录'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="邮箱"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="密码（至少 8 位，含字母和数字）"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      value={regConfirm}
                      onChange={(e) => setRegConfirm(e.target.value)}
                      placeholder="确认密码"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                    />
                  </div>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={regDisplayName}
                      onChange={(e) => setRegDisplayName(e.target.value)}
                      placeholder="显示名称（创作者署名）"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                    />
                  </div>
                  <textarea
                    value={regBio}
                    onChange={(e) => setRegBio(e.target.value)}
                    placeholder="个人简介（可选）"
                    rows={2}
                    className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60 resize-none"
                  />
                  <button
                    onClick={handleRegister}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-900 font-medium text-sm py-2.5 transition-colors"
                  >
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />注册中...</>
                    ) : '注册'}
                  </button>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AccountDialog

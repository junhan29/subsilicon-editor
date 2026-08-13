/**
 * 发码申请客户端：拉取读者在作品内提交的发码申请，并确认/拒绝发码。
 *
 * 与 SubSilicon 官方服务端协议（workToken 归属校验）：
 *  - GET  {base}?action=requests&workId=xxx&workToken=xxx
 *        Header: X-Submit-Token → { requests: [{ id, workId, paymentProof, chapterId, createdAt }] }
 *        workToken 不匹配返回 403 { error:'workToken 无效' }
 *  - POST {base}，body { action:'respond', requestId, workId, workToken, decision:'approve'|'reject' }
 *        → { success:true } 或 { success:false, error }
 *
 * workToken：每作品注册时服务端生成的 64 hex 归属令牌（每次注册轮换，旧值失效），
 * 保存于本机 localStorage，供发码申请面板按作品归属拉取/处理申请。
 */
import { SUBMIT_CONFIG } from './submit-config'

export interface UnlockRequestItem {
  id: string
  workId: string
  paymentProof: string
  chapterId: string | null
  createdAt: number
}

/** 本机 workToken 存储键：workId → workToken */
const UNLOCK_TOKENS_KEY = 'subsilicon_unlock_tokens'

/** 读取本机保存的全部 workToken 映射（workId → workToken）；localStorage 不可用或数据损坏时返回 {} */
export function getAllUnlockWorkTokens(): Record<string, string> {
  try {
    const raw = localStorage.getItem(UNLOCK_TOKENS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>
    }
    return {}
  } catch {
    return {}
  }
}

/** 保存某作品的 workToken 到本机；localStorage 不可用时静默失败 */
export function saveUnlockWorkToken(workId: string, workToken: string): void {
  try {
    const tokens = getAllUnlockWorkTokens()
    tokens[workId] = workToken
    localStorage.setItem(UNLOCK_TOKENS_KEY, JSON.stringify(tokens))
  } catch {
    // 忽略：localStorage 不可用（隐私模式/存储满等）不影响主流程
  }
}

interface UnlockRequestResponse {
  requests?: unknown[]
  success?: boolean
  error?: string
  message?: string
}

function extractError(data: UnlockRequestResponse, fallback: string): string {
  if (typeof data?.error === 'string' && data.error) return data.error
  if (typeof data?.message === 'string' && data.message) return data.message
  return fallback
}

function normalizeRequest(item: unknown): UnlockRequestItem {
  const raw = (item ?? {}) as Record<string, unknown>
  return {
    id: String(raw.id ?? ''),
    workId: String(raw.workId ?? ''),
    paymentProof: String(raw.paymentProof ?? ''),
    chapterId: raw.chapterId == null ? null : String(raw.chapterId),
    createdAt: Number(raw.createdAt) || 0,
  }
}

export async function fetchPendingRequests(workId: string, workToken: string): Promise<UnlockRequestItem[]> {
  try {
    const url = `${SUBMIT_CONFIG.storyUnlockUrl}?action=requests&workId=${encodeURIComponent(workId)}&workToken=${encodeURIComponent(workToken)}`
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Submit-Token': SUBMIT_CONFIG.submitToken,
      },
    })
    const data = (await res.json().catch(() => ({}))) as UnlockRequestResponse
    if (!res.ok) {
      // 403 表示 workToken 归属校验失败（服务端可能只返回 error 文案，兜底确保提示含 workToken）
      const fallback =
        res.status === 403 ? 'workToken 无效，请重新导出该作品以刷新令牌' : `获取发码申请失败（${res.status}）`
      throw new Error(extractError(data, fallback))
    }
    const list = Array.isArray(data?.requests) ? data.requests : []
    return list.map((item) => normalizeRequest(item))
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error('无法连接服务器，请稍后重试')
    }
    if (err instanceof Error) throw err
    throw new Error('获取发码申请失败')
  }
}

export async function respondRequest(
  requestId: string,
  workId: string,
  workToken: string,
  decision: 'approve' | 'reject',
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(SUBMIT_CONFIG.storyUnlockUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Submit-Token': SUBMIT_CONFIG.submitToken,
      },
      body: JSON.stringify({ action: 'respond', requestId, workId, workToken, decision }),
    })
    const data = (await res.json().catch(() => ({}))) as UnlockRequestResponse
    if (res.ok && data?.success === true) {
      return { ok: true }
    }
    return { ok: false, error: extractError(data, 'respond 失败') }
  } catch (err) {
    if (err instanceof TypeError) {
      return { ok: false, error: '无法连接服务器，请稍后重试' }
    }
    return { ok: false, error: err instanceof Error ? err.message : 'respond 失败' }
  }
}

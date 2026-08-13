/** Task 2.4：unlock-request-client —— 拉取发码申请 / 确认或拒绝发码（workToken 归属校验协议） */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchPendingRequests,
  getAllUnlockWorkTokens,
  respondRequest,
  saveUnlockWorkToken,
} from '../unlock-request-client'

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

// workToken 存取依赖 localStorage；node 测试环境无此全局，注入最小 stub
const localStorageStore = new Map<string, string>()
if (!globalThis.localStorage) {
  const stub: Storage = {
    get length() {
      return localStorageStore.size
    },
    clear: () => localStorageStore.clear(),
    getItem: (k) => localStorageStore.get(k) ?? null,
    key: (i) => Array.from(localStorageStore.keys())[i] ?? null,
    removeItem: (k) => {
      localStorageStore.delete(k)
    },
    setItem: (k, v) => {
      localStorageStore.set(k, String(v))
    },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: stub, configurable: true, writable: true })
}

afterEach(() => {
  localStorageStore.clear()
  vi.unstubAllGlobals()
})

describe('fetchPendingRequests', () => {
  it('成功：返回规范化的申请列表，URL 携带 action=requests 与编码后的 workId/workToken，Header 携带 X-Submit-Token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        requests: [
          { id: 'r1', workId: 'w1', paymentProof: '420000123', chapterId: null, createdAt: 1700000000000 },
          { id: 'r2', workId: 'w1', paymentProof: '420000456', chapterId: 'c3', createdAt: 1700000001000 },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const workId = 'work_示例'
    const workToken = 'a1b2c3'.repeat(10) + 'd4e5f6'.repeat(4) // 64 hex
    const result = await fetchPendingRequests(workId, workToken)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: 'r1',
      workId: 'w1',
      paymentProof: '420000123',
      chapterId: null,
      createdAt: 1700000000000,
    })
    expect(result[1].chapterId).toBe('c3')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('action=requests')
    expect(url).toContain(`workId=${encodeURIComponent(workId)}`)
    expect(url).toContain(`workToken=${encodeURIComponent(workToken)}`)
    expect(init.method).toBe('GET')
    expect(init.headers).toMatchObject({ 'X-Submit-Token': expect.any(String) })
  })

  it('403 workToken 不匹配：rejects 且错误消息含 workToken', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, { error: 'workToken 无效' })))

    await expect(fetchPendingRequests('w1', 'bad-token')).rejects.toThrow(/workToken/)
  })

  it('非 2xx：rejects 且错误消息优先取服务端 error 文案', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(500, { error: '服务异常，请稍后重试' })),
    )

    await expect(fetchPendingRequests('w1', 'token')).rejects.toThrow('服务异常，请稍后重试')
  })

  it('网络错误：fetch 抛 TypeError 时转为「无法连接服务器」提示', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(fetchPendingRequests('w1', 'token')).rejects.toThrow('无法连接服务器')
  })
})

describe('respondRequest', () => {
  it('approve 成功：返回 { ok:true }，body JSON 含 action/requestId/workId/workToken/decision', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await respondRequest('r1', 'w1', 'token123', 'approve')

    expect(result).toEqual({ ok: true })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    const body = JSON.parse(String(init.body))
    expect(body).toEqual({
      action: 'respond',
      requestId: 'r1',
      workId: 'w1',
      workToken: 'token123',
      decision: 'approve',
    })
  })

  it('失败：服务端返回 success:false 时返回 { ok:false, error }', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(jsonResponse(200, { success: false, error: '该申请已处理' })),
    )

    const result = await respondRequest('r1', 'w1', 'token123', 'approve')

    expect(result).toEqual({ ok: false, error: '该申请已处理' })
  })

  it('reject 成功：返回 { ok:true } 且 body decision 为 reject', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await respondRequest('r1', 'w1', 'token123', 'reject')

    expect(result).toEqual({ ok: true })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body))
    expect(body.decision).toBe('reject')
  })
})

describe('saveUnlockWorkToken / getAllUnlockWorkTokens', () => {
  it('往返：保存后读回同一映射，多个作品互不覆盖', () => {
    saveUnlockWorkToken('w1', 'a'.repeat(64))
    saveUnlockWorkToken('w2', 'b'.repeat(64))

    expect(getAllUnlockWorkTokens()).toEqual({ w1: 'a'.repeat(64), w2: 'b'.repeat(64) })
  })

  it('同一作品重复保存：以最新 workToken 为准（每次注册轮换）', () => {
    saveUnlockWorkToken('w1', 'old-token')
    saveUnlockWorkToken('w1', 'new-token')

    expect(getAllUnlockWorkTokens()).toEqual({ w1: 'new-token' })
  })

  it('无数据返回 {}；localStorage 数据损坏时不抛错返回 {}', () => {
    expect(getAllUnlockWorkTokens()).toEqual({})

    localStorage.setItem('subsilicon_unlock_tokens', 'not-json{{{')
    expect(getAllUnlockWorkTokens()).toEqual({})
  })
})

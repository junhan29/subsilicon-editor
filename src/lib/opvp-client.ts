export const OPVP_PROTOCOL_VERSION = '1.0'

export interface OPVPVerifyRequest {
  protocolVersion: string
  orderId: string
  workId?: string
  creatorId?: string
  amount?: number
  currency?: string
  timestamp: number
  signature: string
}

export interface OPVPVerifyResponse {
  success: boolean
  verified: boolean
  orderId?: string
  workId?: string
  unlockKey?: {
    keyBase64: string
    ivBase64: string
  }
  expiresAt?: number
  metadata?: Record<string, unknown>
  error?: {
    code: string
    message: string
  }
}

export interface OPVPWebhookPayload {
  protocolVersion: string
  eventType: string
  orderId: string
  creatorId?: string
  workId?: string
  amount?: number
  currency?: string
  paidAt: number
  payerInfo?: {
    name?: string
    email?: string
    phone?: string
  }
  metadata?: Record<string, unknown>
}

export interface OPVPInfoResponse {
  protocolVersion: string
  serviceName: string
  supportedPlatforms: string[]
  features: string[]
  rateLimit?: {
    requestsPerMinute: number
  }
}

export type OPVPErrorCode =
  | 'ORDER_NOT_FOUND'
  | 'ORDER_NOT_PAID'
  | 'AMOUNT_MISMATCH'
  | 'WORK_MISMATCH'
  | 'INVALID_SIGNATURE'
  | 'TIMESTAMP_EXPIRED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'

export function buildPayloadString(payload: Record<string, unknown>): string {
  return Object.keys(payload)
    .filter(key => key !== 'signature' && payload[key] != null)
    .sort()
    .map(key => `${key}=${payload[key]}`)
    .join('&')
}

export async function hmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(message)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function generateSignature(
  payload: Record<string, unknown>,
  secret: string
): Promise<string> {
  const payloadStr = buildPayloadString(payload)
  return hmacSha256(secret, payloadStr)
}

export async function verifySignature(
  payload: Record<string, unknown> & { signature: string },
  secret: string
): Promise<boolean> {
  const expected = await generateSignature(payload, secret)
  const provided = payload.signature
  if (!expected || !provided) return false
  const enc = new TextEncoder()
  const a = enc.encode(expected)
  const b = enc.encode(provided)
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i]
  }
  return result === 0
}

export interface OPVPClientOptions {
  verifierUrl: string
  secret: string
  workId?: string
  creatorId?: string
}

export class OPVPClient {
  private verifierUrl: string
  private secret: string
  private workId?: string
  private creatorId?: string

  constructor(options: OPVPClientOptions) {
    this.verifierUrl = options.verifierUrl.replace(/\/$/, '')
    this.secret = options.secret
    this.workId = options.workId
    this.creatorId = options.creatorId
  }

  async verify(orderId: string, options?: {
    amount?: number
    currency?: string
    workId?: string
  }): Promise<OPVPVerifyResponse> {
    const timestamp = Date.now()
    const payload: Record<string, unknown> = {
      protocolVersion: OPVP_PROTOCOL_VERSION,
      orderId,
      timestamp,
    }

    if (options?.workId || this.workId) {
      payload.workId = options?.workId || this.workId
    }
    if (this.creatorId) {
      payload.creatorId = this.creatorId
    }
    if (options?.amount != null) {
      payload.amount = options.amount
    }
    if (options?.currency) {
      payload.currency = options.currency
    }

    payload.signature = await generateSignature(payload, this.secret)

    try {
      const response = await fetch(`${this.verifierUrl}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        return {
          success: false,
          verified: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: `HTTP ${response.status}`,
          },
        }
      }

      return await response.json() as OPVPVerifyResponse
    } catch (e) {
      return {
        success: false,
        verified: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: e instanceof Error ? e.message : 'Network error',
        },
      }
    }
  }

  async getInfo(): Promise<OPVPInfoResponse | null> {
    try {
      const response = await fetch(`${this.verifierUrl}/info`)
      if (!response.ok) return null
      return await response.json() as OPVPInfoResponse
    } catch {
      return null
    }
  }
}

export function validateTimestamp(timestamp: number, maxAgeMs: number = 5 * 60 * 1000): boolean {
  return Math.abs(Date.now() - timestamp) <= maxAgeMs
}

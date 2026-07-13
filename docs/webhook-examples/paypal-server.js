/**
 * PayPal Webhook 自动解锁服务示例
 *
 * 功能说明：
 * 1. 接收 PayPal 支付完成后的 Webhook 通知
 * 2. 验证 PayPal Webhook 签名，确保事件来自 PayPal 官方
 * 3. 根据订单信息生成 16 位解锁码
 * 4. 将解锁码发送到读者邮箱（示例中仅打印到控制台）
 * 5. 提供 /api/unlock 端点，供读者主动请求重发解锁码
 *
 * 环境变量：
 * - PAYPAL_CLIENT_ID        : PayPal REST API 应用客户端 ID
 * - PAYPAL_CLIENT_SECRET    : PayPal REST API 应用密钥
 * - PAYPAL_WEBHOOK_ID       : PayPal 开发者后台创建的 Webhook ID
 * - ENDPOINT_SECRET         : 用于生成解锁码的 HMAC 密钥，建议 32 字节随机字符串
 *
 * 部署提示：
 * - 本示例使用内存存储（Map），生产环境请替换为 Redis / PostgreSQL
 * - 邮件发送需接入 Nodemailer、Resend 或 SendGrid
 * - PayPal 签名验证需要缓存其公开证书，建议使用 @paypal/checkout-server-sdk
 */

const express = require('express')
const crypto = require('crypto')
const app = express()

// ------------------------------------------------------------------
// 配置读取：所有敏感信息均从环境变量获取，切勿硬编码
// ------------------------------------------------------------------
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID
const ENDPOINT_SECRET = process.env.ENDPOINT_SECRET || crypto.randomBytes(32).toString('hex')

// 内存存储：email -> { code, workId, createdAt }
// 生产环境请使用数据库，并设置 TTL（如 7 天过期）
const unlockCodes = new Map()

/**
 * 生成解锁码（与编辑器本地算法保持一致）
 *
 * 算法说明：
 * 1. 公开绑定部分：SHA256(requestId + '|' + workId) 取前 8 位
 *    - 这部分用于让读者确认解锁码与当前作品/订单绑定
 * 2. HMAC 签名部分：HMAC-SHA256(endpointSecret, requestId + '|' + workId + '|' + timestamp) 取前 8 位
 *    - 这部分用于服务端验证解锁码的合法性
 *
 * @param {string} workId    - 作品唯一标识（如 ss-xxx）
 * @param {string} requestId - 订单/请求唯一标识（如 PayPal Capture ID）
 * @returns {string} 16 位解锁码
 */
function generateUnlockCode(workId, requestId) {
  const binding = crypto
    .createHash('sha256')
    .update(requestId + '|' + workId)
    .digest('hex')
    .slice(0, 8)

  const hmac = crypto
    .createHmac('sha256', ENDPOINT_SECRET)
    .update(requestId + '|' + workId + '|' + Date.now())
    .digest('hex')
    .slice(0, 8)

  return binding + hmac
}

// ------------------------------------------------------------------
// 1. PayPal Webhook 接收端点
// ------------------------------------------------------------------

/**
 * PayPal Webhook 签名验证说明：
 *
 * PayPal 在发送 Webhook 时，会在请求头中包含以下字段：
 * - PAYPAL-TRANSMISSION-ID   : 传输唯一标识
 * - PAYPAL-CERT-ID           : 签名所用证书的 ID
 * - PAYPAL-AUTH-ALGO         : 签名算法（通常为 RSA-SHA256）
 * - PAYPAL-TRANSMISSION-TIME : 传输时间戳
 * - PAYPAL-TRANSMISSION-SIG  : Base64 编码的签名
 *
 * 验证步骤：
 * 1. 拼接待验证字符串：transmissionId + '|' + transmissionTime + '|' + webhookId + '|' + CRC32(body)
 * 2. 使用 PayPal 公开证书验证签名
 * 3. 可选：校验时间戳防止重放攻击
 *
 * 生产环境建议使用 PayPal 官方 SDK（@paypal/checkout-server-sdk）或
 * 直接向 PayPal 证书端点获取证书进行验证。本示例为简化演示，仅解析 JSON。
 */
app.post('/webhook/paypal', express.raw({ type: 'application/json' }), async (req, res) => {
  // 读取 PayPal 签名相关请求头
  const transmissionId = req.headers['paypal-transmission-id']
  const certId = req.headers['paypal-cert-id']
  const authAlgo = req.headers['paypal-auth-algo']
  const transmissionTime = req.headers['paypal-transmission-time']
  const transmissionSig = req.headers['paypal-transmission-sig']

  // ----------------------------------------------------------------
  // 签名验证（生产环境必须实现）
  // ----------------------------------------------------------------
  // 验证逻辑概要：
  //
  //   1. 计算请求体的 CRC32 校验值（PayPal 使用 IEEE 802.3 标准 CRC32）
  //   2. 拼接验证字符串：
  //      `${transmissionId}|${transmissionTime}|${PAYPAL_WEBHOOK_ID}|${crc32(body)}`
  //   3. 从 https://api.paypal.com/v1/notifications/certs/${certId} 获取证书
  //   4. 使用证书中的公钥验证 transmissionSig
  //
  // 建议使用 PayPal SDK 简化验证：
  //   const paypal = require('@paypal/checkout-server-sdk')
  //   // ... 构造环境并调用验证方法
  //
  // 若验证失败，应返回 400/401 并记录日志，防止伪造请求。
  // ----------------------------------------------------------------

  let event
  try {
    event = JSON.parse(req.body)
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON payload' })
  }

  // 监听支付捕获完成事件
  if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    const resource = event.resource

    // PayPal 订单的 custom_id 字段用于传递作品标识 workId
    // 需要在创建订单时设置：purchase_units[0].custom_id = workId
    const customId = resource.custom_id || resource.supplementary_data?.related_ids?.order_id

    // 付款人邮箱：PayPal 返回的 payer.email_address
    const payerEmail = resource.payer?.email_address || event.summary

    if (!customId || !payerEmail) {
      console.error('[PayPal Webhook] Missing custom_id (workId) or payer email')
      return res.status(400).json({ error: 'Missing workId or email' })
    }

    const workId = customId
    const customerEmail = payerEmail

    // 幂等性检查：如果该邮箱已有同作品解锁码，直接返回成功，避免重复生成
    const existing = unlockCodes.get(customerEmail)
    if (existing && existing.workId === workId) {
      console.log(`[PayPal] Unlock code already exists for ${customerEmail}`)
      return res.json({ received: true, idempotent: true })
    }

    // 生成解锁码并存储
    // 使用 PayPal 的 capture ID 作为 requestId，保证唯一性
    const requestId = resource.id
    const code = generateUnlockCode(workId, requestId)
    unlockCodes.set(customerEmail, { code, workId, createdAt: Date.now() })

    // ----------------------------------------------------------------
    // 发送邮件通知读者（请替换为真实邮件服务）
    // ----------------------------------------------------------------
    // 推荐方案：
    // - Resend  : 简单易用，适合开发者，有免费额度
    // - Nodemailer + SMTP : 适合自有邮件服务器
    // - SendGrid / Postmark : 企业级方案
    //
    // 示例（Resend）：
    //   const Resend = require('resend').Resend
    //   const resend = new Resend(process.env.RESEND_API_KEY)
    //   await resend.emails.send({
    //     from: 'unlock@yourdomain.com',
    //     to: customerEmail,
    //     subject: '你的作品解锁码',
    //     html: `<p>感谢购买！你的解锁码是：<strong>${code}</strong></p>`
    //   })
    // ----------------------------------------------------------------

    console.log(`[PayPal] Unlock code generated for ${customerEmail}: ${code}`)
  }

  // 无论是否处理成功，都返回 200，避免 PayPal 重复推送
  res.json({ received: true })
})

// ------------------------------------------------------------------
// 2. 编辑器请求解锁码（读者已付款，但未收到/丢失解锁码）
// ------------------------------------------------------------------

/**
 * 该端点供 Story HTML 中的"我已付款，发送解锁码到邮箱"按钮调用。
 * 服务端根据邮箱查找是否已有未使用的解锁码，若有则重新发送。
 */
app.post('/api/unlock', express.json(), (req, res) => {
  const { action, workId, email, deviceFingerprint } = req.body

  // 参数校验
  if (action !== 'request_unlock') {
    return res.status(400).json({ error: 'Invalid action' })
  }
  if (!workId || !email) {
    return res.status(400).json({ error: 'Missing workId or email' })
  }

  // 查找该邮箱是否有对应作品的解锁码记录
  const record = unlockCodes.get(email)
  if (record && record.workId === workId) {
    // 重新发送邮件（实际项目中调用邮件服务）
    console.log(`[Resend] Unlock code for ${email}: ${record.code}`)
    return res.json({
      success: true,
      message: `解锁码已重新发送到 ${email}`,
      // 如需前端直接展示，可在此返回 code；但出于安全考虑，建议仅通过邮件发送
      // code: record.code
    })
  }

  // 无记录：可能是付款未完成，或 Webhook 尚未到达
  res.status(404).json({
    success: false,
    error: '未找到付款记录，请先完成付款'
  })
})

// ------------------------------------------------------------------
// 启动服务
// ------------------------------------------------------------------
const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`[PayPal Webhook Server] Listening on http://localhost:${PORT}`)
  console.log(`[PayPal Webhook Server] Webhook endpoint: POST http://localhost:${PORT}/webhook/paypal`)
  console.log(`[PayPal Webhook Server] Unlock request endpoint: POST http://localhost:${PORT}/api/unlock`)
})

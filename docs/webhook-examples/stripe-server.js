/**
 * Stripe Webhook 自动解锁服务示例
 *
 * 功能说明：
 * 1. 接收 Stripe Checkout 完成后的 Webhook 通知
 * 2. 根据订单信息生成 16 位解锁码
 * 3. 将解锁码发送到读者邮箱（示例中仅打印到控制台）
 * 4. 提供 /api/unlock 端点，供读者主动请求重发解锁码
 *
 * 环境变量：
 * - STRIPE_SECRET_KEY      : Stripe 私钥（用于后续 API 调用，如退款）
 * - STRIPE_WEBHOOK_SECRET  : Stripe Webhook 签名密钥（用于验证事件真实性）
 * - ENDPOINT_SECRET        : 用于生成解锁码的 HMAC 密钥，建议 32 字节随机字符串
 *
 * 部署提示：
 * - 本示例使用内存存储（Map），生产环境请替换为 Redis / PostgreSQL
 * - 邮件发送需接入 Nodemailer、Resend 或 SendGrid
 * - 建议添加限流和解锁码过期机制
 */

const express = require('express')
const crypto = require('crypto')
const app = express()

// ------------------------------------------------------------------
// 配置读取：所有敏感信息均从环境变量获取，切勿硬编码
// ------------------------------------------------------------------
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
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
 * @param {string} requestId - 订单/请求唯一标识（如 Stripe Session ID）
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
// 1. Stripe Webhook 接收端点
// ------------------------------------------------------------------

/**
 * Stripe 发送 Webhook 时使用 raw body，因此这里使用 express.raw() 中间件。
 * 注意：该路由必须在 express.json() 之前注册，否则 body 会被提前解析为 JSON，
 * 导致签名验证失败。
 */
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature']

  // ----------------------------------------------------------------
  // 签名验证（生产环境必须开启）
  // ----------------------------------------------------------------
  // Stripe 官方 SDK 提供 stripe.webhooks.constructEvent() 方法验证签名。
  // 这里为了示例简洁，仅做 JSON 解析；上线前请替换为以下代码：
  //
  //   const stripe = require('stripe')(STRIPE_SECRET_KEY)
  //   let event
  //   try {
  //     event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET)
  //   } catch (err) {
  //     console.error('Webhook signature verification failed.', err.message)
  //     return res.status(400).send(`Webhook Error: ${err.message}`)
  //   }
  //
  // ----------------------------------------------------------------

  let event
  try {
    event = JSON.parse(req.body)
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON payload' })
  }

  // 监听 Checkout Session 完成事件
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object

    // Stripe Checkout Session 的 metadata 中需要预先传入 workId 和 customerEmail
    const { workId, customerEmail } = session.metadata || {}

    if (!workId || !customerEmail) {
      console.error('[Stripe Webhook] Missing workId or customerEmail in session metadata')
      return res.status(400).json({ error: 'Missing workId or email' })
    }

    // 幂等性检查：如果该邮箱已有同作品解锁码，直接返回成功，避免重复生成
    const existing = unlockCodes.get(customerEmail)
    if (existing && existing.workId === workId) {
      console.log(`[Stripe] Unlock code already exists for ${customerEmail}`)
      return res.json({ received: true, idempotent: true })
    }

    // 生成解锁码并存储
    const code = generateUnlockCode(workId, session.id)
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

    console.log(`[Stripe] Unlock code generated for ${customerEmail}: ${code}`)
  }

  // 无论是否处理成功，都返回 200，避免 Stripe 重复推送
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
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`[Stripe Webhook Server] Listening on http://localhost:${PORT}`)
  console.log(`[Stripe Webhook Server] Webhook endpoint: POST http://localhost:${PORT}/webhook/stripe`)
  console.log(`[Stripe Webhook Server] Unlock request endpoint: POST http://localhost:${PORT}/api/unlock`)
})

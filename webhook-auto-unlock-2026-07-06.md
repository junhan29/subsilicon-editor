# Webhook 自动解锁方案 - 2026-07-06

## 背景

当前编辑器的作品解锁依赖 HMAC-SHA256 本地验证解锁码，适用于：
- 国内：微信/支付宝收款码（手动发送解锁码）
- 第三方：爱发电、面包多（平台提供自动发货）

但海外主流支付渠道（Stripe、PayPal、Patreon、Ko-fi）需要 Webhook 回调机制来实现自动解锁。本方案定义统一的 Webhook 接收和解锁分发协议。

---

## 核心问题

1. **支付完成后如何通知用户**：Stripe/PayPal 付款后，用户留在支付页面，不会自动回到作品
2. **解锁码如何自动发放**：需要服务器接收 Webhook，生成解锁码，通过邮件/页面通知用户
3. **多端一致性**：桌面版导出的 Story HTML 需要支持在线解锁验证

---

## 方案设计

### 架构

```
读者付款
    │
    ▼
[Stripe / PayPal / Patreon / Ko-fi]
    │
    │  Webhook POST
    ▼
[作品墙 / 创作者自建服务器]
    │  验证签名 → 生成解锁码
    │  发送邮件 / 页面通知
    ▼
[读者] ← 解锁码 ───────→ [Story HTML]
                              │
                              │ 输入解锁码
                              ▼
                         本地 HMAC 验证
                              │
                              ▼
                         解密显示内容
```

### 方案 A：创作者自建 Webhook 服务（推荐）

创作者部署一个简单的服务端点，接收支付平台 Webhook，自动发送解锁码。

**服务端伪代码：**

```js
// /api/webhook/stripe
app.post('/api/webhook/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature']
  const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret)

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const { workId, customerEmail } = session.metadata

    // 生成解锁码
    const unlockCode = generateUnlockCode(workId, session.id)

    // 存储到数据库
    await db.unlockCodes.create({
      workId,
      code: unlockCode,
      email: customerEmail,
      createdAt: new Date(),
    })

    // 发送邮件
    await sendEmail(customerEmail, `你的解锁码：${unlockCode}`)
  }

  res.json({ received: true })
})
```

**Story HTML 端调整：**

```js
// 在作品解锁页增加"我已付款，发送解锁码到邮箱"按钮
async function requestUnlockCode(email) {
  const res = await fetch('https://creator-server.com/api/request-unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workId: WORK_ID, email }),
  })
  const data = await res.json()
  if (data.code) {
    showMessage(`解锁码已发送到 ${email}`)
  }
}
```

### 方案 B：作品墙托管 Webhook（中心化）

创作者将作品提交到作品墙时，作品墙代为处理 Webhook：

1. 创作者在作品墙后台配置 Stripe/PayPal Webhook Secret
2. 读者在作品墙页面付款
3. 作品墙接收 Webhook → 生成解锁码 → 邮件通知读者
4. 读者复制解锁码到 Story HTML 中解锁

**优点**：创作者无需自建服务器
**缺点**：作品墙需要维护支付基础设施

### 方案 C：无服务器方案（Zapier / Make.com）

创作者使用无代码自动化工具连接 Stripe → Google Sheets / Airtable → Email：

```
Stripe Webhook → Zapier → 生成解锁码 → 存入 Airtable
                                    → 发送邮件给读者
```

**优点**：无需写代码，成本低
**缺点**：依赖第三方服务，Zapier 有免费额度限制

---

## 解锁码生成规范

与现有本地验证兼容：

```ts
function generateUnlockCode(workId: string, requestId: string): string {
  // 公开绑定部分：SHA256(requestCode + '|' + workId) 前 8 位
  const binding = sha256(requestId + '|' + workId).slice(0, 8)
  // HMAC 签名部分：HMAC(seedKey, requestId + '|' + workId + '|' + timestamp) 前 8 位
  const hmac = hmacSha256(seedKey, requestId + '|' + workId + '|' + Date.now()).slice(0, 8)
  return binding + hmac // 16 位解锁码
}
```

服务端只需存储 `requestId` 和生成的 `unlockCode`，验证时与本地 HMAC 算法一致即可。

---

## 各平台 Webhook 接入要点

### Stripe

- Webhook Endpoint：`POST https://your-server.com/webhook/stripe`
- 监听事件：`checkout.session.completed`
- Metadata 传参：`workId`, `chapter`（在创建 Checkout Session 时放入）

### PayPal

- Webhook Endpoint：`POST https://your-server.com/webhook/paypal`
- 监听事件：`PAYMENT.CAPTURE.COMPLETED`
- 自定义 ID：在创建订单时传入 `custom_id: workId`

### Patreon

- Webhook Endpoint：`POST https://your-server.com/webhook/patreon`
- 监听事件：`pledges:create`（新赞助）
- 需通过 Patreon API 查询会员等级对应的解锁内容

### Ko-fi

- Webhook Endpoint：`POST https://your-server.com/webhook/kofi`
- 监听事件：Shop Order 完成
- Ko-fi 支持在商品设置中传入自定义字段传递 workId

---

## Story HTML 端适配

在导出时增加 Webhook 解锁配置选项：

```ts
interface StoryExportConfig {
  unlockMode: 'manual' | 'webhook' | 'both'
  webhookUrl?: string          // 创作者 webhook 端点
  webhookProvider?: 'stripe' | 'paypal' | 'patreon' | 'kofi'
  // ... 现有配置
}
```

UI 层面在解锁弹窗中增加：
- "通过 Stripe/PayPal 付款"按钮（跳转支付）
- "我已付款，发送解锁码到邮箱"按钮
- 邮件输入框

---

## 安全考虑

1. **Webhook 签名验证**：每个平台都有自己的签名机制，必须验证防止伪造
2. **幂等性**：同一笔付款可能发送多次 Webhook，需用 `requestId` 去重
3. **解锁码时效**：建议设置 7 天有效期，过期需重新申请
4. **限流**：防止恶意请求刷解锁码

---

## 实施优先级

| 优先级 | 内容 | 说明 |
|--------|------|------|
| P0 | Story HTML 增加 Webhook 解锁 UI | 前端适配，导出配置扩展 |
| P1 | Stripe Webhook 示例服务 | Node.js 示例代码 |
| P2 | PayPal Webhook 适配 | 类似 Stripe |
| P3 | Patreon / Ko-fi 适配 | 需求相对较少 |
| P4 | 作品墙托管方案 | 需要后端基础设施 |

---

## 相关文件

- [lib/work-monetization.ts](file:///Users/seey/projects/SubSilicon/open-source/editor/src/lib/work-monetization.ts) — 解锁码生成与验证
- [lib/export-story-html.ts](file:///Users/seey/projects/SubSilicon/open-source/editor/src/lib/export-story-html.ts) — Story HTML 导出
- [lib/submit-providers.ts](file:///Users/seey/projects/SubSilicon/open-source/editor/src/lib/submit-providers.ts) — 作品提交协议

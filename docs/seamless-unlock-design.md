# 无感付款解锁方案设计

## 一、现状问题

当前流程（手动解锁）：

```
读者付款 → 手动联系创作者 → 创作者手动生成解锁码 → 发送解锁码 → 读者手动输入 → 解锁
```

**痛点**：
1. 创作者需要24小时在线响应
2. 读者付款后需要等待，体验差
3. 容易出错，解锁码输错就要重来

---

## 二、目标

**去中心化的同时，实现和平台一样流畅的体验**

```
理想流程：读者付款 → 自动验证 → 即时解锁 → 继续阅读
```

---

## 三、方案设计

### 方案 A：第三方平台自动验证（推荐）

利用爱发电/面包多等平台的公开订单验证 API，实现自动解锁。

#### 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    可执行故事 HTML（读者端）                       │
├─────────────────────────────────────────────────────────────────┤
│  1. 读者点击"解锁"                                                │
│  2. 选择付款方式 → 跳转爱发电/面包多付款页                          │
│  3. 付款成功 → 平台显示订单号                                      │
│  4. 读者回到故事页 → 点击"验证订单"                                │
│  5. 输入订单号 → HTML 内 JS 调用平台公开 API 验证                  │
│  6. 验证通过 → 用预埋的 seedKeyHash 生成临时解锁码                  │
│  7. 解锁成功 → 内容解密显示                                        │
└─────────────────────────────────────────────────────────────────┘

关键：验证在读者端完成，不需要创作者服务器参与
```

#### 技术细节

**1. 导出时预埋验证信息**

```typescript
interface SeamlessUnlockConfig {
  // 第三方平台配置
  platform: 'afdian' | 'mianbaoduo' | 'patreon' | 'ko-fi'
  
  // 平台公开验证 API
  verifyApiUrl: string  // 如：https://afdian.net/api/open/query-order
  
  // 创作者平台 ID
  creatorId: string     // 爱发电用户 ID
  
  // 商品/计划 ID
  planId: string        // 对应的付费计划
  
  // 期望金额（用于验证）
  expectedAmount: number
  
  // 种子密钥哈希（用于生成解锁码）
  seedKeyHash: string
}
```

**2. 读者端验证流程**

```javascript
// 嵌入在 story.html 中的验证逻辑
async function verifyPayment(orderId: string): Promise<boolean> {
  // 调用第三方平台公开 API
  const response = await fetch(`https://afdian.net/api/open/query-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: CREATOR_ID,
      order_id: orderId,
    })
  })
  
  const data = await response.json()
  
  if (data.ec !== 200) return false
  if (data.data.order.status !== 2) return false  // 已支付
  if (data.data.order.plan_id !== PLAN_ID) return false
  
  // 验证通过，生成解锁码
  const unlockCode = await generateLocalUnlockCode(orderId, SEED_KEY_HASH)
  await unlockContent(unlockCode)
  
  return true
}
```

**3. 跨域问题处理**

第三方平台 API 通常需要服务端调用，直接从 HTML 调用会遇到 CORS 问题。

解决方案：
- **方案 A-1**：使用 CORS 代理（如 `https://cors-anywhere.herokuapp.com/`），但这依赖第三方服务
- **方案 A-2**：使用 JSONP（如果平台支持）
- **方案 A-3（推荐）**：导出时，创作者提供一个轻量级验证服务（可以是免费托管如 Vercel/Cloudflare Workers），只做 CORS 转发

```typescript
// 验证服务端点（创作者部署到 Vercel）
export default async function handler(req, res) {
  const { orderId } = req.query
  
  // 转发请求到爱发电 API
  const response = await fetch('https://afdian.net/api/open/query-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: process.env.AFDIAN_USER_ID,
      order_id: orderId,
    })
  })
  
  const data = await response.json()
  res.status(200).json(data)
}
```

---

### 方案 B：智能合约自动解锁（进阶）

如果使用区块链支付，可以实现完全去中心化的自动解锁。

```
读者付款 → 区块链确认 → 智能合约自动触发 → 解锁码生成 → 解锁
```

**优点**：完全去中心化，不需要任何服务器
**缺点**：技术门槛高，需要读者有区块链钱包，国内用户接受度低

---

### 方案 C：本地付款码 + 自动截图验证（简化版）

不需要第三方平台 API，利用 OCR 技术识别付款截图。

```
读者付款 → 上传付款截图 → 本地 OCR 识别金额/时间 → 验证通过 → 解锁
```

**优点**：不依赖任何平台 API
**缺点**：
- OCR 可能识别错误
- 截图可以伪造（需要配合时间戳验证）

---

## 四、推荐实施方案

### 阶段一：手动解锁优化（短期）

1. **预生成解锁码**：创作者导出时，预设一批解锁码，读者付款后自动显示一个
2. **一键复制**：请求码/解锁码支持一键复制，减少输入错误
3. **状态持久化**：解锁状态云端同步（可选），换设备不用重新解锁

### 阶段二：半自动解锁（中期）

1. **第三方平台集成**：支持爱发电/面包多订单号验证
2. **Webhook 支持**：创作者可配置 Webhook URL，实现完全自动验证
3. **验证服务模板**：提供一键部署到 Vercel/Cloudflare 的验证服务模板

### 阶段三：无感解锁（长期）

1. **区块链支付支持**：支持加密货币付款，智能合约自动解锁
2. **统一支付协议**：定义开放协议，任何支付平台都可以接入

---

## 五、技术实现细节（阶段一：手动解锁优化）

### 5.1 预生成解锁码

导出时可执行故事时，预生成一批解锁码：

```typescript
interface PreGeneratedCodes {
  workId: string
  codes: Array<{
    code: string
    usedAt?: number
    deviceFingerprint?: string
  }>
  generatedAt: number
}
```

### 5.2 一键复制体验

在故事 HTML 中：

```html
<!-- 点击请求码直接复制 -->
<div class="request-code" onclick="copyRequestCode()">
  SUBSL-REQ-A1B2C3D4
  <span class="copy-hint">点击复制</span>
</div>
```

### 5.3 解锁码格式简化

将解锁码从 `SUBSL-UNLOCK-XXXXXXXXXXXXXXXX` 简化为 8 位短码：

```
旧格式：SUBSL-UNLOCK-A1B2C3D4E5F6G7H8
新格式：A1B2-C3D4（8位，更易输入）
```

后台仍然用完整格式验证，但显示给用户的是短码。

---

## 六、总结

| 方案 | 去中心化程度 | 用户体验 | 实现难度 | 推荐度 |
|------|------------|---------|---------|--------|
| 现有手动解锁 | ⭐⭐⭐⭐⭐ | ⭐⭐ | 已实现 | - |
| 手动解锁优化 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 低 | ⭐⭐⭐⭐ |
| 第三方平台验证 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 中 | ⭐⭐⭐⭐⭐ |
| Webhook 自动解锁 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 中 | ⭐⭐⭐⭐ |
| 区块链自动解锁 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 高 | ⭐⭐⭐ |

**推荐路径**：先实施阶段一优化，再逐步接入第三方平台验证 API。
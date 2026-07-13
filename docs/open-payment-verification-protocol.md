# 开放支付验证协议 (OPVP)

Open Payment Verification Protocol — 让任何支付平台都能接入 SubSilicon 自助解锁体系。

## 一、设计原则

1. **去中心化**：协议不依赖任何中心平台，创作者可自由选择支付渠道
2. **简单易用**：接入门槛低，任何开发者都能快速实现
3. **安全可靠**：基于标准加密算法，防止伪造和重放攻击
4. **隐私保护**：最小化数据交换，保护读者和创作者隐私

## 二、协议版本

当前版本：**v1.0**

## 三、核心概念

### 3.1 参与方

- **创作者 (Creator)**：发布付费作品的人
- **读者 (Reader)**：购买作品的人
- **支付平台 (Payment Platform)**：处理支付的第三方服务（爱发电、面包多、Stripe 等）
- **验证服务 (Verifier)**：实现 OPVP 协议的服务，负责验证订单真实性

### 3.2 工作流

```
读者付款 → 支付平台 → 验证服务 → 故事HTML → 解锁
     ↓         ↓          ↓            ↓
   订单号    Webhook    验证API     本地解密
```

## 四、验证端点规范

### 4.1 验证请求

```
POST {verifierUrl}/verify
Content-Type: application/json
```

**请求体：**

```json
{
  "protocolVersion": "1.0",
  "orderId": "订单号",
  "workId": "作品ID",
  "creatorId": "创作者ID",
  "amount": 18.8,
  "currency": "CNY",
  "timestamp": 1710000000000,
  "signature": "HMAC-SHA256签名"
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| protocolVersion | string | 是 | 协议版本，当前为 "1.0" |
| orderId | string | 是 | 支付平台订单号 |
| workId | string | 否 | 作品ID，用于验证订单对应作品 |
| creatorId | string | 否 | 创作者在支付平台的ID |
| amount | number | 否 | 订单金额，用于验证金额匹配 |
| currency | string | 否 | 货币代码，默认 "CNY" |
| timestamp | number | 是 | 请求时间戳（毫秒），用于防止重放 |
| signature | string | 是 | 请求签名，HMAC-SHA256 |

### 4.2 验证响应

**成功响应 (200 OK)：**

```json
{
  "success": true,
  "verified": true,
  "orderId": "订单号",
  "workId": "作品ID",
  "unlockKey": {
    "keyBase64": "base64编码的解密密钥",
    "ivBase64": "base64编码的初始向量"
  },
  "expiresAt": 1710000000000,
  "metadata": {
    "platform": "afdian",
    "payerName": "付款人昵称"
  }
}
```

**失败响应 (200 OK)：**

```json
{
  "success": false,
  "verified": false,
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "订单不存在或未支付"
  }
}
```

**错误码：**

| 错误码 | 说明 |
|--------|------|
| ORDER_NOT_FOUND | 订单不存在 |
| ORDER_NOT_PAID | 订单未支付 |
| AMOUNT_MISMATCH | 金额不匹配 |
| WORK_MISMATCH | 作品不匹配 |
| INVALID_SIGNATURE | 签名无效 |
| TIMESTAMP_EXPIRED | 请求已过期 |
| RATE_LIMITED | 请求过于频繁 |
| INTERNAL_ERROR | 服务器内部错误 |

### 4.3 签名算法

使用 HMAC-SHA256 对请求进行签名：

```
signature = HMAC_SHA256(secret, payload_string)
```

**payload_string 生成规则：**

1. 按字母顺序排列所有字段（除 signature）
2. 使用 `key=value` 格式，用 `&` 连接
3. 值为 null 或 undefined 的字段忽略

**示例：**

```
amount=18.8&creatorId=user123&currency=CNY&orderId=ORD123&protocolVersion=1.0&timestamp=1710000000000&workId=work456
```

## 五、Webhook 端点规范

### 5.1 Webhook 请求

支付平台向验证服务发送支付成功通知：

```
POST {webhookUrl}
Content-Type: application/json
X-OPVP-Signature: HMAC-SHA256签名
X-OPVP-Timestamp: 时间戳
```

**请求体：**

```json
{
  "protocolVersion": "1.0",
  "eventType": "payment.succeeded",
  "orderId": "订单号",
  "creatorId": "创作者ID",
  "workId": "作品ID",
  "amount": 18.8,
  "currency": "CNY",
  "paidAt": 1710000000000,
  "payerInfo": {
    "name": "付款人昵称",
    "email": "payer@example.com",
    "phone": "13800138000"
  },
  "metadata": {}
}
```

### 5.2 Webhook 响应

```json
{
  "success": true,
  "received": true
}
```

## 六、发现端点（可选）

用于自动发现验证服务支持的功能：

```
GET {verifierUrl}/info
```

**响应：**

```json
{
  "protocolVersion": "1.0",
  "serviceName": "我的验证服务",
  "supportedPlatforms": ["afdian", "mianbaoduo", "stripe"],
  "features": ["verify", "webhook", "unlockKey"],
  "rateLimit": {
    "requestsPerMinute": 60
  }
}
```

## 七、安全建议

1. **使用 HTTPS**：所有通信必须使用 HTTPS
2. **签名验证**：必须验证请求签名，防止伪造
3. **时间戳校验**：拒绝超过 5 分钟的请求，防止重放攻击
4. **速率限制**：实施合理的速率限制，防止滥用
5. **密钥管理**：定期轮换共享密钥，使用环境变量存储
6. **错误信息**：错误响应不要暴露内部实现细节

## 八、接入示例

### 8.1 Node.js (Express)

```javascript
const crypto = require('crypto');
const express = require('express');
const app = express();

const SHARED_SECRET = process.env.OPVP_SECRET;

function generateSignature(payload) {
  const sorted = Object.keys(payload)
    .filter(k => k !== 'signature' && payload[k] != null)
    .sort()
    .map(k => `${k}=${payload[k]}`)
    .join('&');
  return crypto.createHmac('sha256', SHARED_SECRET)
    .update(sorted)
    .digest('hex');
}

function verifySignature(payload) {
  const expected = generateSignature(payload);
  return crypto.timingSafeEqual(
    Buffer.from(payload.signature),
    Buffer.from(expected)
  );
}

app.post('/verify', express.json(), async (req, res) => {
  const body = req.body;
  
  if (!verifySignature(body)) {
    return res.status(401).json({
      success: false,
      verified: false,
      error: { code: 'INVALID_SIGNATURE', message: '签名无效' }
    });
  }
  
  if (Date.now() - body.timestamp > 5 * 60 * 1000) {
    return res.json({
      success: false,
      verified: false,
      error: { code: 'TIMESTAMP_EXPIRED', message: '请求已过期' }
    });
  }
  
  const order = await lookupOrder(body.orderId);
  
  if (!order) {
    return res.json({
      success: false,
      verified: false,
      error: { code: 'ORDER_NOT_FOUND', message: '订单不存在' }
    });
  }
  
  if (order.status !== 'paid') {
    return res.json({
      success: false,
      verified: false,
      error: { code: 'ORDER_NOT_PAID', message: '订单未支付' }
    });
  }
  
  res.json({
    success: true,
    verified: true,
    orderId: body.orderId,
    workId: body.workId,
    metadata: { platform: order.platform }
  });
});
```

### 8.2 客户端 (故事HTML)

```javascript
async function verifyOrderOPVP(verifierUrl, orderId, workId, secret) {
  const timestamp = Date.now();
  const payload = {
    protocolVersion: '1.0',
    orderId,
    workId,
    timestamp,
  };
  
  const signature = await hmacSha256(secret, buildPayloadString(payload));
  payload.signature = signature;
  
  const response = await fetch(`${verifierUrl}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  
  return await response.json();
}
```

## 九、平台适配器

OPVP 定义了统一接口，各平台通过适配器转换：

| 平台 | 适配器类型 | 说明 |
|------|-----------|------|
| 爱发电 | webhook + api | 支持订单查询API和Webhook |
| 面包多 | webhook + api | 支持订单查询API和Webhook |
| Stripe | webhook | 支持Webhook通知 |
| Patreon | webhook | 支持Webhook通知 |
| Ko-fi | webhook | 支持Webhook通知 |
| 微信支付 | webhook + api | 支持订单查询和支付通知 |
| 支付宝 | webhook + api | 支持订单查询和支付通知 |

## 十、版本兼容性

- 主版本号不同：不兼容
- 次版本号不同：向后兼容（高版本服务可处理低版本请求）
- 修订号不同：完全兼容

客户端应在请求中指定 `protocolVersion`，服务端应根据版本号处理请求。

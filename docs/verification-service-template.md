# 订单验证服务模板

可一键部署到 Vercel/Cloudflare 的订单验证服务，支持爱发电和面包多订单自动验证。

## 快速开始

### 方式一：一键部署到 Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/junhan29/subsilicon-verification-service)

### 方式二：一键部署到 Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/junhan29/subsilicon-verification-service)

### 方式三：本地运行

```bash
git clone https://github.com/junhan29/subsilicon-verification-service.git
cd subsilicon-verification-service
npm install
npm run dev
```

## 环境变量

部署时需要配置以下环境变量：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `AFDIAN_API_TOKEN` | 爱发电 API Token（可选） | `your-afdian-token` |
| `MIANBAODUO_API_KEY` | 面包多 API Key（可选） | `your-mianbaoduo-key` |
| `SECRET_KEY` | 加密密钥（用于生成解锁密钥） | `32-character-secret-key` |

## API 端点

### POST /api/verify

验证订单号

**请求体：**
```json
{
  "orderId": "订单号",
  "platform": "afdian | mianbaoduo | patreon | ko-fi",
  "platformUserId": "平台用户ID",
  "planId": "方案/商品ID（可选）",
  "workId": "作品ID（可选）"
}
```

**成功响应：**
```json
{
  "success": true,
  "verified": true,
  "keyBase64": "解密密钥（可选）",
  "ivBase64": "初始化向量（可选）",
  "orderInfo": {
    "amount": 18.8,
    "status": "paid",
    "createdAt": "2026-07-13T10:00:00Z"
  }
}
```

**失败响应：**
```json
{
  "success": false,
  "verified": false,
  "error": "订单不存在或未支付"
}
```

### POST /api/webhook

接收第三方平台 Webhook 通知

**请求体：**
```json
{
  "platform": "afdian | mianbaoduo",
  "event": "order.paid | order.refunded",
  "data": {
    "orderId": "订单号",
    "amount": 18.8,
    "userId": "用户ID",
    "planId": "方案ID"
  }
}
```

**响应：**
```json
{
  "success": true,
  "processed": true
}
```

## 验证流程

```
读者输入订单号
    ↓
验证服务查询第三方平台 API
    ↓
确认订单已支付且属于指定创作者
    ↓
返回验证结果（含密钥或标记验证通过）
    ↓
前端使用密钥解密故事内容
```

## 支持的平台

| 平台 | API 验证 | Webhook |
|------|----------|---------|
| 爱发电 | ✅ | ✅ |
| 面包多 | ✅ | ✅ |
| Patreon | ✅ | ✅ |
| Ko-fi | ✅ | ✅ |

## 安全说明

1. 验证服务仅验证订单状态，不存储任何读者个人数据
2. 密钥生成使用 AES-256-GCM 加密算法
3. 支持 IP 白名单和请求频率限制
4. 所有 API 通信使用 HTTPS

## 部署配置示例

### Vercel 配置 (`vercel.json`)

```json
{
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 10
    }
  },
  "build": {
    "command": "npm run build"
  }
}
```

### Cloudflare 配置 (`wrangler.toml`)

```toml
name = "subsilicon-verification"
main = "src/index.ts"
compatibility_date = "2026-07-01"

[vars]
AFDIAN_API_TOKEN = ""
MIANBAODUO_API_KEY = ""
SECRET_KEY = ""
```

## 自定义验证逻辑

你可以修改 `src/verifiers/` 目录下的验证器文件来添加自定义验证逻辑：

```typescript
// src/verifiers/custom.ts
export async function verifyCustomOrder(orderId: string, config: VerificationConfig) {
  // 实现自定义验证逻辑
  return {
    verified: true,
    amount: 18.8,
    status: 'paid'
  };
}
```

## 许可证

MIT License

# Webhook 自动解锁示例

这些示例展示了如何为海外支付渠道搭建自动解锁服务。

## 快速开始

1. 选择一个支付平台（Stripe / PayPal / Patreon / Ko-fi）
2. 复制对应的示例代码到你的服务器
3. 配置环境变量（API 密钥、Webhook Secret 等）
4. 将 Webhook URL 填入编辑器的导出配置

## 统一接口

### 请求解锁码（编辑器 → 你的服务器）

```
POST {你的 webhook URL}
Content-Type: application/json

{
  "action": "request_unlock",
  "workId": "ss-xxx",
  "email": "reader@example.com",
  "deviceFingerprint": "sha256(...)"
}
```

响应：
```json
{
  "success": true,
  "message": "解锁码已发送到 reader@example.com"
}
```

### 验证解锁码（Story HTML → 你的服务器 / subsilicon 服务器）

```
POST https://subsilicon.cn/api/creator/unlock
Content-Type: application/json

{
  "action": "unlock",
  "workId": "ss-xxx",
  "orderNo": "解锁码",
  "deviceFingerprint": "sha256(...)"
}
```

## 部署建议

- Vercel / Netlify Functions（免费额度足够）
- Railway / Render（$5/月起步）
- 自建 VPS（DigitalOcean / Linode / AWS Lightsail）

# 去中心化作品名录协议 (DDP)

Decentralized Directory Protocol — 让作品可以在任何展示墙之间自由流动，创作者只需发布一次，就能在全网被发现。

## 一、设计原则

1. **开放自由**：任何人都可以搭建作品展示墙，不需要中心平台批准
2. **创作者主权**：作品数据由创作者掌控，可随时下架或更新
3. **互操作性**：所有展示墙使用统一协议，作品可以跨墙流动
4. **去中心发现**：通过聚合多个名录源实现作品发现

## 二、作品元数据格式

### 2.1 作品清单 (work.json)

每个作品导出时会生成一个标准元数据文件，可用于提交到任意展示墙。

```json
{
  "protocolVersion": "1.0",
  "workId": "work_abc123def456",
  "title": "我的互动故事",
  "summary": "一句话简介，不超过100字",
  "description": "详细介绍，可以是 Markdown 格式",
  "tags": ["古风", "悬疑", "恋爱"],
  "genre": "adventure",
  "language": "zh-CN",
  
  "creator": {
    "id": "creator_xyz789",
    "name": "创作者昵称",
    "bio": "创作者简介",
    "avatar": "https://example.com/avatar.jpg",
    "contact": {
      "wechat": "wechat_id",
      "email": "creator@example.com",
      "twitter": "@handle"
    },
    "externalLinks": [
      { "type": "afdian", "url": "https://afdian.net/@name" },
      { "type": "website", "url": "https://my-site.com" }
    ]
  },
  
  "coverImage": "data:image/jpeg;base64,...",
  "screenshots": [
    "data:image/png;base64,..."
  ],
  
  "stats": {
    "nodeCount": 42,
    "endingCount": 5,
    "estimatedReadTime": 30,
    "wordCount": 15000
  },
  
  "monetization": {
    "type": "free" | "paid" | "donation",
    "price": 18.8,
    "currency": "CNY",
    "paymentMethods": [
      {
        "type": "wechat_manual",
        "name": "微信支付",
        "qrCode": "data:image/png;base64,..."
      },
      {
        "type": "opvp",
        "name": "爱发电自动验证",
        "verifierUrl": "https://my-verifier.vercel.app/verify",
        "platform": "afdian"
      }
    ]
  },
  
  "content": {
    "type": "html_file",
    "url": "https://example.com/story.html",
    "fileSize": 2097152,
    "hash": "sha256:abc123...",
    "encryption": {
      "type": "aes-256-gcm",
      "unlockMethod": "offline_code" | "opvp" | "none"
    }
  },
  
  "preview": {
    "type": "html_file",
    "url": "https://example.com/preview.html",
    "previewNodes": ["node1", "node2", "node3"]
  },
  
  "publishedAt": 1710000000000,
  "updatedAt": 1710000000000,
  "version": "1.2.0",
  
  "signature": "创作者签名，用于验证作品真实性"
}
```

## 三、名录 API 规范

任何实现了以下 API 的服务都可以作为作品名录源。

### 3.1 获取作品列表

```
GET {directoryUrl}/api/works?page=1&limit=20&tag=古风&sort=popular
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| limit | number | 否 | 每页数量，默认 20，最大 50 |
| tag | string | 否 | 按标签筛选 |
| search | string | 否 | 关键词搜索 |
| sort | string | 否 | 排序方式：newest, popular, random |
| creatorId | string | 否 | 按创作者筛选 |

**响应：**

```json
{
  "success": true,
  "data": {
    "works": [
      {
        "workId": "work_abc123",
        "title": "作品标题",
        "summary": "一句话简介",
        "tags": ["古风", "悬疑"],
        "coverImage": "https://...",
        "creatorName": "创作者",
        "monetizationType": "paid",
        "price": 18.8,
        "currency": "CNY",
        "stats": {
          "nodeCount": 42,
          "endingCount": 5
        },
        "publishedAt": 1710000000000
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 20,
    "hasMore": true
  }
}
```

### 3.2 获取作品详情

```
GET {directoryUrl}/api/works/{workId}
```

**响应：** 返回完整的作品元数据（格式见 2.1）。

### 3.3 提交作品

```
POST {directoryUrl}/api/submit
Content-Type: multipart/form-data
X-Submit-Token: 可选的提交令牌
```

请求体格式与 [作品提交协议](submit-protocol.md) 一致。

### 3.4 获取标签列表

```
GET {directoryUrl}/api/tags
```

**响应：**

```json
{
  "success": true,
  "data": {
    "tags": [
      { "name": "古风", "count": 128 },
      { "name": "悬疑", "count": 96 }
    ]
  }
}
```

### 3.5 获取创作者信息

```
GET {directoryUrl}/api/creators/{creatorId}
```

**响应：**

```json
{
  "success": true,
  "data": {
    "creatorId": "creator_abc",
    "name": "创作者昵称",
    "bio": "简介",
    "avatar": "https://...",
    "workCount": 5,
    "joinedAt": 1710000000000
  }
}
```

## 四、名录聚合 (Directory Federation)

作品发现可以通过聚合多个名录源实现，不需要中心服务器。

### 4.1 名录源配置

```json
{
  "directories": [
    {
      "id": "subsilicon-official",
      "name": "SubSilicon 官方名录",
      "url": "https://subsilicon.cn/api",
      "type": "official",
      "enabled": true
    },
    {
      "id": "my-personal-wall",
      "name": "我的个人展示墙",
      "url": "https://my-wall.example.com/api",
      "type": "personal",
      "submitToken": "optional-token",
      "enabled": true
    }
  ]
}
```

### 4.2 聚合搜索

编辑器内置的作品发现功能可以同时查询多个名录源，合并去重后展示。

```
搜索请求 → 名录源A → 结果A
         → 名录源B → 结果B
         → 名录源C → 结果C
              ↓
         合并去重 + 排序 → 展示给用户
```

## 五、作品真实性验证

为防止伪造作品，使用数字签名机制：

1. **创作者密钥对**：创作者在本地生成 ED25519 密钥对
2. **作品签名**：发布时用私钥对作品元数据签名
3. **公钥验证**：展示墙和读者用公钥验证作品真实性

```json
{
  "workId": "work_abc",
  "creator": {
    "id": "creator_xyz",
    "publicKey": "ed25519:public_key_here"
  },
  "signature": "signature_of_work_metadata"
}
```

## 六、与现有系统的关系

- **提交协议**：DDP 扩展了 [作品提交协议](submit-protocol.md)，增加了发现和搜索功能
- **OPVP**：支付验证使用 [开放支付验证协议](open-payment-verification-protocol.md)
- **可执行故事 HTML**：作品内容使用 SubSilicon 标准的可执行 HTML 格式

## 七、实现路线

### Phase 1: 基础协议
- 作品元数据格式定义
- 名录 API 规范
- 提交协议扩展

### Phase 2: 编辑器集成
- 多名录源配置管理
- 作品发现/搜索功能
- 一键发布到多个名录

### Phase 3: 生态扩展
- 创作者身份验证
- 作品签名验证
- 名录聚合搜索

## 八、接入指南

### 搭建自己的作品展示墙

1. 实现 DDP API 规范（见第三节）
2. 在编辑器中添加你的名录源
3. 提交作品到你的展示墙
4. 分享给你的读者

### 接入现有作品名录

1. 在编辑器中打开「作品发现」
2. 添加名录源 URL
3. 浏览和搜索作品
4. 点击跳转到作品页面

# 作品提交协议

编辑器支持向任何实现了以下公开协议的展示服务提交作品。默认内置的是 SubSilicon 官方作品墙，你可以在上传对话框中添加自定义服务商（`+ 添加展示墙`）。

## 请求格式

```
POST {provider.apiUrl}
Headers:
  {provider.authHeader}: {provider.authToken}   # 默认 header 名: X-Submit-Token
Body (multipart/form-data):
  creatorEmail      string         创作者邮箱
  creatorName       string         创作者显示名称
  creatorBio        string   opt   创作者简介
  title             string         作品标题
  summary           string         一句话简介
  tags              string         JSON 字符串数组, 例如 ["scifi","romance"]
  coverImage        File     opt   封面图 (推荐 16:9, ≤2MB)
  screenshot-N      File     opt   截图 (N 从 0 开始, ≤6 张)
  contactInfo       string   opt   联系方式 (如微信号)
  externalLink      string   opt   外部链接 (如爱发电、面包多)
  previewHtml       File           预览 HTML (text/html)
  workId            string   opt   作品 ID (用于更新已有作品)
```

## 响应格式

```
2xx          成功
4xx / 5xx    失败, body 应为 { "message": string }
```

## 编程方式注册自定义服务商

```ts
import { addProvider, setActiveProvider } from '@editor/lib/submit-providers'

addProvider({
  name: '我的展示墙',
  apiUrl: 'https://my-showcase.example.com/api/submit',
  authHeader: 'X-Submit-Token',  // 可选, 默认 X-Submit-Token
  authToken: 'my-secret-token',
  description: '个人展示站点',
  enabled: true,
})
setActiveProvider('custom.<timestamp>')
```
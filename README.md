# SubSilicon Editor

> 零代码可视化互动叙事编辑器 | Zero-code visual interactive narrative editor

[中文介绍](#中文介绍) | [English](#english)

---

## 中文介绍

### 项目简介

SubSilicon Editor 是一个基于 React + Electron 的**开源可视化互动叙事编辑器**。创作者无需编写代码，通过拖拽节点即可创作分支叙事作品，并支持付费解锁、导出分发等完整功能。

**核心理念**：让创作者专注于故事本身，而不是技术实现。

### 产品截图

> 📸 暂无官方截图，欢迎贡献你的使用截图！

<!-- 截图占位 - 后续可替换为真实截图
![编辑器主界面](docs/screenshots/main-editor.png)
![节点编辑](docs/screenshots/node-editor.png)
![故事预览](docs/screenshots/story-preview.png)
-->

### 三条核心承诺

1. **零抽成** — 我们不经手你的任何收入，创作者直接收款
2. **版权归创作者** — 作品 100% 属于创作者，平台不主张任何权利
3. **允许自主分发** — 导出独立文件，你想怎么发就怎么发

### ✨ 功能亮点

#### 🎨 可视化编辑
- 基于 React Flow 的节点画布，拖拽连线
- 10 种节点类型，覆盖各种叙事场景
- 节点分组（6 种颜色），可折叠管理
- 实时预览（LivePreview），边做边看效果
- 拼图编辑器（PuzzleEditor）— 图层化场景编辑
- 对齐辅助线 + 节点搜索

#### 🎭 角色与场景系统
- 丰富的角色档案：性别、职业、性格、外貌、背景、口癖、技能、动机、关系
- 多表情立绘系统（normal/happy/sad/angry/surprised 等 10 种表情）
- 立绘位置（左/中/右）、缩放、透明度调节
- 场景库：批量上传图片，支持拼图图层
- 音频库：BGM / SFX / 语音，支持循环与音量控制

#### 📊 变量与条件系统
- 三种变量类型：string / number / boolean
- 条件组合：AND / OR 逻辑自由组合
- 9 种比较运算符：`==` `!=` `>` `>=` `<` `<=` `contains` `startsWith` `endsWith`
- 可视化条件编辑器，无需手写代码
- 选项效果：set / add / subtract / multiply

#### 💰 多渠道收款（创作者直接收款，平台不碰钱）
- **个人收款码**：微信、支付宝
- **第三方平台**：爱发电、面包多、知识星球、自定义
- **多渠道配置**：可同时配置多个收款渠道
- 付费粒度：整本 / 章节 / 单节点
- 免费预览节点设置
- HMAC-SHA256 本地验证解锁码（无需服务器）
- 收入记录与年度追踪

#### ⚠️ 年收入合规预警系统
基于 2026 年最新政策的本地合规提醒：
- 年收入 6 万元：个税申报提醒
- 年收入 10 万元：建议注册个体工商户
- 年收入 12 万元：必须个税申报，强制建议商户收款码
- 月均 10 万元：金税四期监控预警
- 单笔 5000 元：个人收款码限额提醒
- 四级预警状态：safe / notice / warning / critical

#### 🤖 AI 辅助创作（用户自备 API 密钥）
- 支持服务商：OpenAI、Anthropic、百度智能云（文心一言）、阿里云（通义千问）、腾讯（混元）、自定义
- AI 润色（4 种风格：通用/生动/简洁/文学）
- AI 排版（对话/叙事/混合三种格式）
- AI 续写
- AI 生成角色描述
- AI 生成场景描述

#### 📦 导出与分发
- **HTML**：标准网页导出
- **Story HTML**：带 DRM 保护的独立可执行文件（AES-256-GCM 加密 + 内嵌付费锁屏 UI）
- **ZIP**：打包所有资源
- **EPUB**：电子书格式
- **脚本**：纯文本剧本导出
- 预览 HTML（用于分享试读）

#### ✍️ 创作辅助
- 版本管理（保存/恢复/对比/删除快照）
- 节点批注系统（类 Figma 评论：comment / todo / warning / idea，支持回复与解决）
- 写作统计（节点数、字数、写作时长）
- 故事质量检查面板
- 自动保存
- 历史记录（撤销/重做）
- 大纲解析

#### 📑 模板系统（6 种内置模板）
| 模板名称 | 分类 | 难度 | 特点 |
|---------|------|------|------|
| 新手教程 | 新手入门 | 入门 | 3 分钟入门最小闭环 |
| 选择冒险 | 新手入门 | 入门 | 基础分支选择 |
| 心动瞬间 | 恋爱故事 | 初级 | 好感度变量系统 |
| 迷雾真相 | 悬疑推理 | 初级 | 线索收集机制 |
| 深夜来访 | 恐怖惊悚 | 初级 | 氛围营造技巧 |
| 勇者传说 | 冒险奇幻 | 高级 | CG 过场 + 战斗 |

#### 🔧 其他特性
- 暗色主题（多种主题预设）
- 快捷键系统（可自定义）
- 本地存储（IndexedDB，含迁移机制）
- WebDAV 云同步
- 资源库管理
- 引导式新手教程（Tour）
- 国际化导出
- 试验水印
- 无障碍支持

### 🚀 快速开始

#### 环境要求
- Node.js 18+
- npm 9+
- 操作系统：macOS / Windows / Linux

#### 安装与运行

```bash
# 1. 克隆仓库
git clone <repository-url>
cd editor

# 2. 安装依赖
npm install

# 3. 启动 Web 开发模式
npm run dev

# 4. 启动 Electron 桌面端（另开一个终端）
npm run electron:dev
```

#### 构建

```bash
# 构建 Web 版本
npm run build

# 构建 Electron 桌面端
npm run electron:build
```

#### 运行测试

```bash
# 运行单元测试
npm test
```

### 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript |
| 桌面端 | Electron |
| 节点编辑器 | @xyflow/react (React Flow) |
| UI 组件 | Radix UI + Tailwind CSS |
| 本地存储 | IndexedDB |
| 加密 | Web Crypto API (AES-256-GCM / HMAC-SHA256) |
| 构建工具 | Vite + webpack |

### 项目结构

```
editor/
├── src/
│   ├── components/          # React 组件
│   │   ├── editor/          # 编辑器核心组件
│   │   │   ├── nodes/       # 10 种节点组件
│   │   │   ├── panels/      # 节点属性面板
│   │   │   ├── puzzle/      # 拼图场景编辑器
│   │   │   ├── preview/     # 故事预览
│   │   │   ├── runtime/     # 故事运行时
│   │   │   ├── onboarding/  # 新手引导
│   │   │   └── ...          # 其他编辑器面板
│   │   └── ui/              # 基础 UI 组件（Radix）
│   ├── hooks/               # React Hooks（自动保存、历史、快捷键、画布状态）
│   ├── lib/                 # 核心逻辑库
│   │   ├── local-db/        # IndexedDB 本地数据库
│   │   ├── __tests__/       # 单元测试
│   │   ├── ai-service.ts    # AI 服务
│   │   ├── work-monetization.ts     # 付费解锁系统
│   │   ├── compliance-tracker.ts    # 合规预警
│   │   ├── export-*.ts      # 多种导出格式
│   │   ├── story-templates.ts       # 故事模板
│   │   ├── story-encrypt.ts         # AES 加密
│   │   ├── version-store.ts         # 版本管理
│   │   └── ...
│   ├── stores/              # 状态管理
│   └── types/               # TypeScript 类型定义
├── desktop/                 # Electron 主进程
├── build/                   # 构建资源与图标
├── .eslintrc.cjs
├── .prettierrc
└── tsconfig.json
```

### 贡献

欢迎提交 Issue 和 PR！请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解详细的贡献指南。

### 展示墙提交协议

编辑器支持向**任何实现了以下公开协议的展示服务**提交作品。默认内置的是 SubSilicon 官方作品墙，你可以在上传对话框中添加自定义服务商（`+ 添加展示墙`）。

#### 请求格式

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

#### 响应格式

```
2xx          成功
4xx / 5xx    失败, body 应为 { "message": string }
```

#### 编程方式注册自定义服务商

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

### License

MIT License — 你可以自由使用、修改、分发、商用。

---

## English

### Project Overview

SubSilicon Editor is an **open-source visual interactive narrative editor** built with React + Electron. Creators can craft branching narrative works by dragging and dropping nodes — no coding required. It supports paid unlocks, export, and distribution.

**Core Philosophy**: Let creators focus on the story itself, not the technical implementation.

### Screenshots

> 📸 No official screenshots yet. Contributions welcome!

<!-- Screenshot placeholders - replace with real screenshots later
![Main Editor](docs/screenshots/main-editor.png)
![Node Editor](docs/screenshots/node-editor.png)
![Story Preview](docs/screenshots/story-preview.png)
-->

### Three Core Promises

1. **Zero Commission** — We never touch your revenue; creators get paid directly
2. **Creator-Owned Copyright** — 100% of the work belongs to the creator
3. **Self-Distribution Allowed** — Export standalone files, distribute however you like

### ✨ Features

#### 🎨 Visual Editing
- React Flow-based canvas with drag-and-drop connections
- 10 node types covering various narrative scenarios
- Node grouping (6 colors), collapsible
- Live preview — see effects as you build
- Puzzle editor — layered scene editing (background/image/character/text/effect)
- Alignment guides + node search

#### 🎭 Character & Scene System
- Rich character profiles: gender, occupation, personality, appearance, background, speech, skills, motivation, relations
- Multi-emotion sprites (10 emotions: normal/happy/sad/angry/surprised/etc.)
- Sprite position (left/center/right), scale, opacity
- Scene library: batch upload, puzzle layers supported
- Audio library: BGM / SFX / Voice with loop and volume

#### 📊 Variable & Condition System
- Three variable types: string / number / boolean
- Condition groups: AND / OR logic
- 9 comparison operators: `==` `!=` `>` `>=` `<` `<=` `contains` `startsWith` `endsWith`
- Visual condition editor — no coding needed
- Choice effects: set / add / subtract / multiply

#### 💰 Multi-Channel Payments (Creators Receive Directly, Platform Never Touches Money)
- **Manual QR codes**: WeChat Pay, Alipay
- **Third-party platforms**: Afdian, Mianbaoduo, ZSXQ, custom
- **Multi-channel config**: multiple payment channels simultaneously
- Payment granularity: whole / chapter / node
- Free preview nodes
- HMAC-SHA256 local unlock code verification (no server needed)
- Income records and yearly tracking

#### ⚠️ Annual Income Compliance Warning System
Local compliance reminders based on 2026 policies:
- ¥60,000 yearly: tax filing reminder
- ¥100,000 yearly: recommend registering as individual business
- ¥120,000 yearly: mandatory tax filing, merchant QR code strongly recommended
- ¥100,000 monthly: Golden Tax Phase IV monitoring warning
- ¥5,000 single payment: personal QR code limit reminder
- Four warning levels: safe / notice / warning / critical

#### 🤖 AI-Assisted Creation (Bring Your Own API Key)
- Supported providers: OpenAI, Anthropic, Baidu (ERNIE), Aliyun (Qwen), Tencent (Hunyuan), custom
- AI polish (4 styles: general/vivid/concise/literary)
- AI layout (dialogue/narrative/mixed)
- AI continuation
- AI character description generation
- AI scene description generation

#### 📦 Export & Distribution
- **HTML**: standard web export
- **Story HTML**: DRM-protected standalone executable (AES-256-GCM encryption + embedded paywall UI)
- **ZIP**: packaged resources
- **EPUB**: e-book format
- **Script**: plain text screenplay
- Preview HTML (for sharing trials)

#### ✍️ Writing Assistance
- Version management (save/restore/compare/delete snapshots)
- Node annotation system (Figma-style comments: comment/todo/warning/idea, with replies and resolve)
- Writing stats (node count, word count, writing duration)
- Story quality check panel
- Auto-save
- History (undo/redo)
- Outline parsing

#### 📑 Template System (6 Built-in Templates)
| Template | Category | Difficulty | Features |
|----------|----------|------------|----------|
| Beginner Tutorial | Beginner | Easy | 3-minute minimal loop |
| Choice Adventure | Beginner | Easy | Basic branching |
| Heartbeat Moment | Romance | Medium | Affinity variable system |
| Misty Truth | Mystery | Medium | Clue collection mechanism |
| Late Night Visit | Horror | Medium | Atmosphere building |
| Hero Legend | Adventure | Hard | CG cutscenes + combat |

#### 🔧 Other Features
- Dark theme (multiple theme presets)
- Keyboard shortcuts (customizable)
- Local storage (IndexedDB with migration)
- WebDAV cloud sync
- Asset library management
- Guided onboarding tour
- i18n export
- Trial watermark
- Accessibility support

### 🚀 Quick Start

#### Requirements
- Node.js 18+
- npm 9+
- OS: macOS / Windows / Linux

#### Installation & Running

```bash
# 1. Clone the repository
git clone <repository-url>
cd editor

# 2. Install dependencies
npm install

# 3. Start web development mode
npm run dev

# 4. Launch Electron desktop (in another terminal)
npm run electron:dev
```

#### Build

```bash
# Build web version
npm run build

# Build Electron desktop
npm run electron:build
```

#### Running Tests

```bash
# Run unit tests
npm test
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 + TypeScript |
| Desktop | Electron |
| Node Editor | @xyflow/react (React Flow) |
| UI Components | Radix UI + Tailwind CSS |
| Local Storage | IndexedDB |
| Encryption | Web Crypto API (AES-256-GCM / HMAC-SHA256) |
| Build Tools | Vite + webpack |

### Project Structure

```
editor/
├── src/
│   ├── components/          # React components
│   │   ├── editor/          # Editor core components
│   │   │   ├── nodes/       # 10 node type components
│   │   │   ├── panels/      # Node property panels
│   │   │   ├── puzzle/      # Puzzle scene editor
│   │   │   ├── preview/     # Story preview
│   │   │   ├── runtime/     # Story runtime
│   │   │   ├── onboarding/  # Onboarding guide
│   │   │   └── ...          # Other editor panels
│   │   └── ui/              # Base UI components (Radix)
│   ├── hooks/               # React Hooks (autosave, history, shortcuts, canvas state)
│   ├── lib/                 # Core logic library
│   │   ├── local-db/        # IndexedDB local database
│   │   ├── __tests__/       # Unit tests
│   │   ├── ai-service.ts    # AI service
│   │   ├── work-monetization.ts     # Payment unlock system
│   │   ├── compliance-tracker.ts    # Compliance warnings
│   │   ├── export-*.ts      # Multiple export formats
│   │   ├── story-templates.ts       # Story templates
│   │   ├── story-encrypt.ts         # AES encryption
│   │   ├── version-store.ts         # Version management
│   │   └── ...
│   ├── stores/              # State management
│   └── types/               # TypeScript type definitions
├── desktop/                 # Electron main process
├── build/                   # Build assets & icons
├── .eslintrc.cjs
├── .prettierrc
└── tsconfig.json
```

### Contributing

Issues and PRs are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed contribution guidelines.

### Work Wall Submit Protocol

The editor supports submitting works to **any showcase service** that implements the public protocol below. The default built-in provider is the SubSilicon official work wall; you can add custom providers in the upload dialog (`+ Add Showcase`).

#### Request

```
POST {provider.apiUrl}
Headers:
  {provider.authHeader}: {provider.authToken}   # default header name: X-Submit-Token
Body (multipart/form-data):
  creatorEmail      string         creator email
  creatorName       string         creator display name
  creatorBio        string   opt   creator bio
  title             string         work title
  summary           string         one-line summary
  tags              string         JSON string array, e.g. ["scifi","romance"]
  coverImage        File     opt   cover image (16:9 recommended, ≤2MB)
  screenshot-N      File     opt   screenshots (N from 0, ≤6 images)
  contactInfo       string   opt   contact info (e.g. WeChat ID)
  externalLink      string   opt   external link (e.g. afdian, mianbaoduo)
  previewHtml       File           preview HTML (text/html)
  workId            string   opt   work ID (for updating existing work)
```

#### Response

```
2xx          success
4xx / 5xx    failure, body should be { "message": string }
```

#### Register a custom provider programmatically

```ts
import { addProvider, setActiveProvider } from '@editor/lib/submit-providers'

addProvider({
  name: 'My Showcase',
  apiUrl: 'https://my-showcase.example.com/api/submit',
  authHeader: 'X-Submit-Token',  // optional, default X-Submit-Token
  authToken: 'my-secret-token',
  description: 'Personal showcase site',
  enabled: true,
})
setActiveProvider('custom.<timestamp>')
```

### License

MIT License — Free to use, modify, distribute, and commercialize.

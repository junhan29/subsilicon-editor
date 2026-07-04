# SubSilicon Editor

> 零代码可视化互动叙事编辑器 | Zero-code visual interactive narrative editor

[中文介绍](#中文介绍) | [English](#english)

## 中文介绍

### 项目简介
SubSilicon Editor 是一个基于 React + Electron 的可视化互动叙事编辑器。
创作者无需编写代码，通过拖拽节点即可创作分支叙事作品。

### 三条核心承诺
1. **零抽成** — 我们不经手你的任何收入
2. **版权归创作者** — 作品100%属于创作者
3. **允许自主分发** — 导出独立文件，你想怎么发就怎么发

### 功能特性

#### 节点系统（10 种节点类型）
- **对话节点**（dialogue）— 角色对话，支持立绘表情、位置、文字动画、背景音效、语音
- **选择节点**（choice）— 分支选择，支持变量效果、条件显示、固定跳转
- **旁白节点**（narration）— 叙述文本，支持打字机/淡入/上滑动画
- **结局节点**（ending）— 多结局（好/坏/普通/隐藏），支持封面图与副标题
- **解锁节点**（unlock）— 付费解锁内容
- **汇聚节点**（gather）— 多分支汇合点
- **条件节点**（condition）— 基于变量表达式的逻辑分支
- **CG 节点**（cg）— 图片/视频过场，支持黑边电影感、转场、跳过控制
- **跳转节点**（jump）— 跨章节跳转
- **随机节点**（random）— 加权随机分支

#### 可视化编辑
- 基于 React Flow 的节点画布，拖拽连线
- 节点分组（6 种颜色），可折叠
- 实时预览（LivePreview）
- 拼图编辑器（PuzzleEditor）— 图层化场景编辑（背景/图片/角色/文字/特效）
- 对齐辅助线
- 节点搜索

#### 角色与场景系统
- 角色管理：性别、职业、性格、外貌、背景、口癖、技能、动机、关系
- 多表情立绘（normal/happy/sad/angry/surprised 等 10 种表情）
- 立绘位置（左/中/右）、缩放、透明度
- 场景库：上传图片批量创建，支持拼图图层
- 音频库：BGM / SFX / 语音，支持循环与音量

#### 变量与条件系统
- 三种变量类型：string / number / boolean
- 条件组合：AND / OR 逻辑
- 9 种比较运算符：`==` `!=` `>` `>=` `<` `<=` `contains` `startsWith` `endsWith`
- 可视化条件编辑器
- 选项效果：set / add / subtract / multiply

#### 多渠道收款（创作者直接收款，平台不碰钱）
- **个人收款码**：微信、支付宝
- **第三方平台**：爱发电、面包多、知识星球、自定义
- **多渠道配置**：可同时配置多个收款渠道
- 付费粒度：整本 / 章节 / 单节点
- 免费预览节点设置
- HMAC-SHA256 本地验证解锁码（无需服务器）
- 收入记录与年度追踪

#### 年收入合规预警系统
基于 2026 年最新政策的本地合规提醒：
- 年收入 6 万元：个税申报提醒
- 年收入 10 万元：建议注册个体工商户
- 年收入 12 万元：必须个税申报，强制建议商户收款码
- 月均 10 万元：金税四期监控预警
- 单笔 5000 元：个人收款码限额提醒
- 四级预警状态：safe / notice / warning / critical

#### AI 辅助创作（用户自备 API 密钥）
- 支持服务商：OpenAI、Anthropic、百度智能云（文心一言）、阿里云（通义千问）、腾讯（混元）、自定义
- AI 润色（4 种风格：通用/生动/简洁/文学）
- AI 排版（对话/叙事/混合三种格式）
- AI 续写
- AI 生成角色描述
- AI 生成场景描述

#### 导出与分发
- **HTML**：标准网页导出
- **Story HTML**：带 DRM 保护的独立可执行文件（AES-256-GCM 加密 + 内嵌付费锁屏 UI）
- **ZIP**：打包所有资源
- **EPUB**：电子书格式
- **脚本**：纯文本剧本导出
- 预览 HTML（用于分享试读）

#### 创作辅助
- 版本管理（保存/恢复/对比/删除快照）
- 节点批注系统（类 Figma 评论：comment / todo / warning / idea，支持回复与解决）
- 写作统计（节点数、字数、写作时长）
- 故事质量检查面板
- 自动保存
- 历史记录（撤销/重做）
- 大纲解析

#### 模板系统（6 种内置模板）
- 新手教程（3 分钟入门最小闭环）
- 选择冒险（新手入门）
- 心动瞬间（恋爱 + 好感度变量）
- 迷雾真相（悬疑 + 线索收集）
- 深夜来访（恐怖氛围）
- 勇者传说（冒险 + CG 过场）

#### 其他特性
- 暗色主题（多种主题预设）
- 快捷键系统（可自定义）
- 本地存储（IndexedDB，含迁移机制）
- WebDAV 云同步
- 资源库管理
- 引导式新手教程（Tour）
- 国际化导出
- 试验水印
- 无障碍 announc

### 技术栈
- **React 18** + **TypeScript**
- **Electron** — 桌面端跨平台
- **@xyflow/react**（React Flow）— 节点编辑器
- **Radix UI** + **Tailwind CSS** — UI 组件
- **IndexedDB** — 本地存储
- **Web Crypto API** — AES-256-GCM / HMAC-SHA256 加密

### 快速开始
```bash
# 安装依赖
npm install

# 启动开发模式
npm run dev

# 启动 Electron 桌面端
npm run electron:dev

# 构建
npm run build
npm run electron:build
```

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
├── .eslintrc.cjs
├── .prettierrc
└── tsconfig.json
```

### 贡献
欢迎提交 Issue 和 PR。请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。

### License
MIT License — 你可以自由使用、修改、分发、商用。

---

## English

### Project Overview
SubSilicon Editor is a visual interactive narrative editor built with React + Electron.
Creators can craft branching narrative works by dragging and dropping nodes — no coding required.

### Three Core Promises
1. **Zero Commission** — We never touch your revenue
2. **Creator-Owned Copyright** — 100% of the work belongs to the creator
3. **Self-Distribution Allowed** — Export standalone files, distribute however you like

### Features

#### Node System (10 Node Types)
- **Dialogue** — Character dialogue with sprites, emotions, positions, text animations, BGM, voice
- **Choice** — Branching choices with variable effects, conditional display, fixed jumps
- **Narration** — Narrative text with typewriter/fade/slide-up animations
- **Ending** — Multiple endings (good/bad/neutral/secret) with cover image and subtitle
- **Unlock** — Paid content unlock
- **Gather** — Branch merge point
- **Condition** — Logic branching based on variable expressions
- **CG** — Image/video cutscenes with letterbox, transitions, skip control
- **Jump** — Cross-chapter navigation
- **Random** — Weighted random branching

#### Visual Editing
- React Flow-based canvas with drag-and-drop connections
- Node grouping (6 colors), collapsible
- Live preview
- Puzzle editor — layered scene editing (background/image/character/text/effect)
- Alignment guides
- Node search

#### Character & Scene System
- Character management: gender, occupation, personality, appearance, background, speech, skills, motivation, relations
- Multi-emotion sprites (10 emotions: normal/happy/sad/angry/surprised/etc.)
- Sprite position (left/center/right), scale, opacity
- Scene library: batch upload, puzzle layers supported
- Audio library: BGM / SFX / Voice with loop and volume

#### Variable & Condition System
- Three variable types: string / number / boolean
- Condition groups: AND / OR logic
- 9 comparison operators: `==` `!=` `>` `>=` `<` `<=` `contains` `startsWith` `endsWith`
- Visual condition editor
- Choice effects: set / add / subtract / multiply

#### Multi-Channel Payments (Creators Receive Directly, Platform Never Touches Money)
- **Manual QR codes**: WeChat Pay, Alipay
- **Third-party platforms**: Afdian, Mianbaoduo, ZSXQ, custom
- **Multi-channel config**: multiple payment channels simultaneously
- Payment granularity: whole / chapter / node
- Free preview nodes
- HMAC-SHA256 local unlock code verification (no server needed)
- Income records and yearly tracking

#### Annual Income Compliance Warning System
Local compliance reminders based on 2026 policies:
- ¥60,000 yearly: tax filing reminder
- ¥100,000 yearly: recommend registering as individual business
- ¥120,000 yearly: mandatory tax filing, merchant QR code strongly recommended
- ¥100,000 monthly: Golden Tax Phase IV monitoring warning
- ¥5,000 single payment: personal QR code limit reminder
- Four warning levels: safe / notice / warning / critical

#### AI-Assisted Creation (Bring Your Own API Key)
- Supported providers: OpenAI, Anthropic, Baidu (ERNIE), Aliyun (Qwen), Tencent (Hunyuan), custom
- AI polish (4 styles: general/vivid/concise/literary)
- AI layout (dialogue/narrative/mixed)
- AI continuation
- AI character description generation
- AI scene description generation

#### Export & Distribution
- **HTML**: standard web export
- **Story HTML**: DRM-protected standalone executable (AES-256-GCM encryption + embedded paywall UI)
- **ZIP**: packaged resources
- **EPUB**: e-book format
- **Script**: plain text screenplay
- Preview HTML (for sharing trials)

#### Writing Assistance
- Version management (save/restore/compare/delete snapshots)
- Node annotation system (Figma-style comments: comment/todo/warning/idea, with replies and resolve)
- Writing stats (node count, word count, writing duration)
- Story quality check panel
- Auto-save
- History (undo/redo)
- Outline parsing

#### Template System (6 Built-in Templates)
- Beginner Tutorial (3-minute minimal loop)
- Choice Adventure (beginner)
- Heartbeat Moment (romance + affinity variables)
- Misty Truth (mystery + clue collection)
- Late Night Visit (horror atmosphere)
- Hero Legend (adventure + CG cutscenes)

#### Other Features
- Dark theme (multiple theme presets)
- Keyboard shortcuts (customizable)
- Local storage (IndexedDB with migration)
- WebDAV cloud sync
- Asset library management
- Guided onboarding tour
- i18n export
- Trial watermark
- Accessibility announcer

### Tech Stack
- **React 18** + **TypeScript**
- **Electron** — cross-platform desktop
- **@xyflow/react** (React Flow) — node editor
- **Radix UI** + **Tailwind CSS** — UI components
- **IndexedDB** — local storage
- **Web Crypto API** — AES-256-GCM / HMAC-SHA256 encryption

### Quick Start
```bash
# Install dependencies
npm install

# Start development mode
npm run dev

# Launch Electron desktop
npm run electron:dev

# Build
npm run build
npm run electron:build
```

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
├── .eslintrc.cjs
├── .prettierrc
└── tsconfig.json
```

### Contributing
Issues and PRs are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md).

### Work Wall Submit Protocol

The editor supports submitting works to **any showcase service** that implements the public protocol below. The default built-in provider is the SubSilicon official work wall; you can add custom providers in the upload dialog (`+ 添加展示墙`).

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
  contactInfo       string   opt   contact (e.g. WeChat ID)
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

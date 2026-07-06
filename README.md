# SubSilicon Editor

零代码可视化互动叙事编辑器

## 核心亮点

- **开源免费** · MIT 协议，自由使用、修改、分发、商用
- **零代码创作** · 拖拽式节点编辑，无需编程基础
- **完整分发链路** · 支持 HTML/ZIP/EPUB/Script 多种导出格式
- **创作者直达收益** · 平台零抽成，支持微信/支付宝/爱发电等多渠道收款

## 快速开始

### 环境要求

- Node.js 18+
- npm 9+
- 操作系统：macOS / Windows / Linux

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/junhan29/subsilicon-editor.git
cd subsilicon-editor

# 安装依赖
npm install

# 启动 Web 开发模式
npm run dev

# 启动 Electron 桌面端（另开一个终端）
npm run electron:dev
```

### 构建

```bash
# 构建 Web 版本
npm run build

# 构建 Electron 桌面端
npm run electron:build
```

### 运行测试

```bash
npm test
```

## 功能概览

### 可视化编辑

- 基于 React Flow 的节点画布，拖拽连线
- 10 种节点类型（对话/选择/旁白/结局/CG/条件/跳转/随机/解锁/汇聚）
- 节点分组管理，支持折叠
- 实时预览，边做边看效果
- 拼图编辑器，图层化场景编辑

### 角色与场景

- 完整角色档案（性别、性格、背景、立绘表情）
- 多表情立绘系统，支持位置/缩放/透明度调节
- 场景库与音频库管理
- 4 通道音频混音（BGM/BGS/SE/Voice）

### 变量与条件

- 三种变量类型：string / number / boolean
- AND/OR 条件组合，9 种比较运算符
- 可视化条件编辑器，无需手写代码
- 选项效果：set / add / subtract / multiply

### 多渠道收款

- 个人收款码：微信、支付宝
- 第三方平台：爱发电、面包多
- HMAC-SHA256 本地验证，无需服务器
- 付费粒度：整本 / 章节 / 单节点

### AI 辅助创作

支持 OpenAI、Anthropic、文心一言、通义千问、混元等服务商（用户自备 API 密钥）：

- AI 润色（通用/生动/简洁/文学）
- AI 排版（对话/叙事/混合）
- AI 续写、角色描述、场景描述生成

### 导出与分发

- HTML：标准网页导出
- Story HTML：带 DRM 保护的独立可执行文件（AES-256-GCM 加密）
- ZIP：打包所有资源
- EPUB：电子书格式
- 脚本：纯文本剧本导出

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript |
| 桌面端 | Electron |
| 节点编辑器 | @xyflow/react (React Flow) |
| UI 组件 | Radix UI + Tailwind CSS |
| 本地存储 | IndexedDB |
| 加密 | Web Crypto API |
| 构建工具 | Vite + webpack |

## 项目结构

```
editor/
├── src/
│   ├── components/          # React 组件
│   ├── hooks/               # React Hooks
│   ├── lib/                 # 核心逻辑库
│   ├── stores/              # 状态管理
│   └── types/               # TypeScript 类型
├── desktop/                 # Electron 主进程
├── build/                   # 构建资源
└── docs/                    # 文档
```

## 贡献

欢迎提交 Issue 和 PR！请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 作品提交协议

详情参见 [docs/submit-protocol.md](./docs/submit-protocol.md)。

## License

MIT License
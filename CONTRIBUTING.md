# 贡献指南

## 目录

- [项目架构概述](#项目架构概述)
- [本地开发环境搭建](#本地开发环境搭建)
- [如何贡献](#如何贡献)
- [代码规范](#代码规范)
- [提交信息规范](#提交信息规范)

---

## 项目架构概述

SubSilicon Editor 采用 React + Electron 的双进程架构：

- **主进程**（`desktop/main.ts`）：窗口管理、系统交互、文件系统、原生 API
- **渲染进程**（React + TypeScript）：编辑器 UI、节点画布（React Flow）、故事运行时、状态管理、本地存储（IndexedDB）

### 核心模块

#### 1. 节点编辑器（Node Editor）
- **位置**：`src/components/editor/`
- **核心**：基于 `@xyflow/react` (React Flow) 构建
- **节点类型**（10 种）：
  - `dialogue` - 对话节点
  - `choice` - 选择节点
  - `narration` - 旁白节点
  - `ending` - 结局节点
  - `unlock` - 解锁节点
  - `gather` - 汇聚节点
  - `condition` - 条件节点
  - `cg` - CG 过场节点
  - `jump` - 跳转节点
  - `random` - 随机节点

#### 2. 故事运行时（Story Runtime）
- **位置**：`src/components/editor/runtime/` 和 `src/components/editor/preview/`
- **功能**：解析故事图、执行节点逻辑、渲染故事内容
- **特点**：支持变量系统、条件判断、分支跳转

#### 3. 状态管理
- **位置**：`src/stores/` 和 `src/hooks/`
- **主要 Store**：
  - `editor-canvas-store.ts` - 编辑器画布状态
  - `history-store.ts` - 历史记录（撤销/重做）
  - `version-store.ts` - 版本管理
  - `annotation-store.ts` - 批注系统

#### 4. 本地数据库
- **位置**：`src/lib/local-db/`
- **技术**：IndexedDB (Dexie.js)
- **存储内容**：作品数据、资源文件、版本快照、账户信息

#### 5. 导出系统
- **位置**：`src/lib/export-*.ts`
- **支持格式**：HTML、Story HTML、ZIP、EPUB、脚本

#### 6. 付费解锁系统
- **位置**：`src/lib/work-monetization.ts`
- **技术**：HMAC-SHA256 本地验证
- **特点**：无需服务器，创作者直接收款

---

## 本地开发环境搭建

### 环境要求

| 工具 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | 18.x 或更高 | 推荐使用 LTS 版本 |
| npm | 9.x 或更高 | 随 Node.js 一起安装 |
| Git | 最新版 | 版本控制 |
| 操作系统 | macOS / Windows / Linux | 跨平台支持 |

### 克隆仓库

```bash
git clone <repository-url>
cd editor
```

### 安装依赖

```bash
npm install
```

首次安装可能需要较长时间，因为 Electron 二进制文件较大。如果 Electron 下载超时，可设置镜像源：

```bash
npm config set electron_mirror https://npmmirror.com/mirrors/electron/
```

### 启动开发模式

#### Web 模式开发（推荐用于 UI 开发）

```bash
npm run dev
```

访问 `http://localhost:5173` 即可在浏览器中使用编辑器。Web 模式下，部分 Electron 专属功能（如文件系统访问）可能不可用。

#### Electron 桌面端开发（完整功能）

需要两个终端：

终端 1：启动 Vite 开发服务器
```bash
npm run dev
```

终端 2：启动 Electron
```bash
npm run electron:dev
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并监听文件变化
npm test -- --watch

# 查看测试覆盖率
npm test -- --coverage
```

### 代码检查

```bash
# TypeScript 类型检查
npx tsc --noEmit

# ESLint 检查
npm run lint

# Prettier 格式化检查
npm run format:check
```

---

## 如何贡献

### 报告 Bug

1. 在 GitHub Issues 中搜索是否已有相同问题
2. 如果没有，创建新 Issue，包含以下信息：
   - **问题描述**：清晰简洁地描述问题
   - **复现步骤**：
     1. 打开 '...'
     2. 点击 '....'
     3. 滚动到 '....'
     4. 看到错误
   - **预期行为**：描述你期望发生的事情
   - **实际行为**：描述实际发生的事情
   - **截图**：如果适用，添加截图帮助说明
   - **环境信息**：
     - 操作系统：[e.g. macOS 14.0]
     - Node.js 版本：[e.g. 18.17.0]
     - 编辑器版本：[e.g. 1.0.0]

### 提交功能建议

1. 在 GitHub Issues 中创建新 Issue，使用 "Feature Request" 标签
2. 描述功能的使用场景
3. 描述期望的实现方式（如果有想法）
4. 说明为什么这个功能对大多数用户有用

### 提交代码

#### 准备工作

1. Fork 本仓库
2. 将 Fork 的仓库克隆到本地
3. 添加原仓库为上游：
   ```bash
   git remote add upstream <original-repo-url>
   ```

#### 开发流程

1. 从 `main` 分支创建新分支：
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

2. 进行开发，确保：
   - 代码遵循项目规范
   - 添加必要的测试
   - 更新相关文档

3. 提交更改：
   ```bash
   git add .
   git commit -m 'feat: add some feature'
   ```

4. 同步上游最新代码：
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

5. 推送到你的 Fork：
   ```bash
   git push origin feature/your-feature-name
   ```

6. 在 GitHub 上创建 Pull Request

#### PR 要求

- **清晰的标题**：简明扼要地描述改动
- **详细的描述**：
  - 改动了什么
  - 为什么这样改
  - 如何验证
- **关联 Issue**：如果相关，引用 Issue 编号
- **截图**：如果是 UI 改动，提供前后对比截图
- **测试**：确保所有测试通过

---

## 代码规范

### TypeScript 规范

#### 类型定义

- 优先使用 `interface` 定义对象类型，`type` 用于联合类型、工具类型等
- 禁止使用 `any`，除非确实必要（并添加注释说明原因）
- 函数必须显式声明返回类型
- 导出的类型放在 `src/types/` 目录下

```typescript
interface User {
  id: string
  name: string
  email: string
}

type Status = 'idle' | 'loading' | 'success' | 'error'
```

#### React 组件

- 使用函数组件 + Hooks
- 使用 TypeScript 定义 Props 类型
- 组件文件使用 `.tsx` 扩展名
- 组件名使用 PascalCase

```tsx
interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary'
}

export function Button({ children, onClick, variant = 'primary' }: ButtonProps) {
  return <button onClick={onClick}>{children}</button>
}
```

### 目录与文件规范

#### 命名约定

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件文件 | PascalCase | `StoryCanvas.tsx` |
| Hook 文件 | camelCase，use 开头 | `use-autosave.ts` |
| 工具函数 | camelCase | `story-encrypt.ts` |
| 类型定义 | camelCase | `editor.ts` |
| 测试文件 | 与源文件同名 + `.test` | `condition-builder.test.ts` |

#### 导入顺序

1. React 相关导入
2. 第三方库导入
3. 项目内部导入（使用 `@editor/` 别名）
4. 类型导入
5. 样式导入

```tsx
import { useState, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { Button } from '@editor/components/ui/button'
import type { StoryNode } from '@editor/types/editor'
import './custom-edge.css'
```

### 样式规范

- 使用 Tailwind CSS 进行样式开发
- 组件样式优先使用 utility class
- 复杂样式使用 `cn()` 函数组合
- 避免使用内联样式

```tsx
import { cn } from '@editor/lib/utils'

<div className={cn(
  'p-4 rounded-lg border',
  isActive ? 'bg-primary text-primary-foreground' : 'bg-background'
)}>
  Content
</div>
```

### 状态管理

- 简单组件状态使用 `useState`
- 复杂状态使用 Zustand store
- 避免 props drilling，合理使用 Context 或 Store
- Store 放在 `src/stores/` 目录

### 性能优化

- 合理使用 `useMemo` 和 `useCallback`
- 列表渲染必须加 key
- 避免不必要的重渲染
- 大数据量考虑虚拟化

---

## 提交信息规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

### 格式

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Type 类型

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档变更 |
| `style` | 代码风格调整（不影响功能） |
| `refactor` | 重构（既不是新功能也不是修 bug） |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建/工具/依赖等辅助工具变动 |

### 示例

```
feat: add dark mode support

- Implement theme toggle
- Add system preference detection
- Persist theme choice in localStorage

Closes #123
```

```
fix: fix node selection not working on touch devices

The touchstart event was preventing selection. Added touch event
handlers with proper delay to distinguish between scroll and tap.

Fixes #456
```

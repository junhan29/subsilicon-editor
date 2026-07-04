# 贡献指南

## 如何贡献

### 报告 Bug
1. 在 GitHub Issues 中搜索是否已有相同问题
2. 如果没有，创建新 Issue，包含：
   - 问题描述
   - 复现步骤
   - 预期行为和实际行为
   - 截图（如果有）
   - 操作系统和版本

### 提交功能建议
1. 在 GitHub Issues 中创建新 Issue
2. 描述功能的使用场景
3. 如果可能，描述期望的实现方式

### 提交代码
1. Fork 本仓库
2. 创建分支：`git checkout -b feature/your-feature-name`
3. 提交更改：`git commit -m 'feat: add some feature'`
4. 推送分支：`git push origin feature/your-feature-name`
5. 创建 Pull Request

### 代码规范
- 使用 TypeScript
- 遵循现有的代码风格（Prettier + ESLint）
- 提交信息遵循 Conventional Commits：
  - `feat:` 新功能
  - `fix:` Bug 修复
  - `docs:` 文档
  - `refactor:` 重构
  - `test:` 测试
  - `chore:` 其他

### 开发环境
- Node.js 18+
- npm 9+
- 操作系统：macOS / Windows / Linux

### 运行测试
```bash
npm test
```

### 构建
```bash
npm run build
npm run electron:build
```

## 行为准则
请保持尊重和友善。我们欢迎所有背景的贡献者。

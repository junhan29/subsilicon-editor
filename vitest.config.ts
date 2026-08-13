import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

/**
 * Vitest 配置
 *
 * - 默认环境为 node（既有 lib/stores 纯单元测试保持不变）
 * - 组件渲染测试在文件顶部用 `// @vitest-environment happy-dom` 单独切换环境
 * - coverage 使用 @vitest/coverage-v8，阈值基于当前基线设定（见 scripts/verify 说明）
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@editor': resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/main.tsx',
        'src/types/**',
        'src/vite-env.d.ts',
      ],
      // 覆盖率门禁：以当前基线为下限（2026-08-13 首次采集），防止新增改动拉低覆盖率
      thresholds: {
        statements: 15,
        branches: 60,
        functions: 20,
        lines: 15,
      },
    },
  },
})

// 组件测试公共 setup：jest-dom 断言扩展 + 每次测试后清理 DOM
// （vitest 未开启 globals，@testing-library/react 的自动 cleanup 依赖全局 afterEach，需手动注册）
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

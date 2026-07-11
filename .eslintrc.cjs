/**
 * ESLint 配置 - @subsilicon/editor
 *
 * 注意：项目根目录使用 ESLint 9（默认 flat config）。
 * 使用 .eslintrc.cjs 旧版配置格式时，需在运行时设置环境变量：
 *   ESLINT_USE_FLAT_CONFIG=false
 * 或在 lint 脚本中前置该变量。
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    // 不允许 any 类型
    '@typescript-eslint/no-explicit-any': 'warn',
    // 未使用变量
    '@typescript-eslint/no-unused-vars': 'warn',
    'no-unused-vars': 'off',
    // 排序导入（简单规则）
    'sort-imports': [
      'warn',
      {
        ignoreCase: false,
        ignoreDeclarationSort: false,
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
      },
    ],
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  ignorePatterns: ['dist/', 'build/', 'node_modules/', '*.config.js', '*.config.cjs'],
}

// 阅读器主题预设

export interface ReaderTheme {
  id: string
  name: string
  dialogueBoxStyle: 'classic' | 'modern' | 'minimal' // 对话框风格
  primaryColor: string
  backgroundColor: string
  textColor: string
  accentColor: string
  fontFamily: string
  dialogueBoxOpacity: number
  textAnimation: 'none' | 'typewriter' | 'fade' | 'slide'
  fontSize: number
}

// 5 个预设主题
export const READER_THEME_PRESETS: ReaderTheme[] = [
  {
    id: 'dark-night',
    name: '暗夜模式',
    dialogueBoxStyle: 'modern',
    primaryColor: '#3b82f6',
    backgroundColor: '#0f172a',
    textColor: '#e2e8f0',
    accentColor: '#60a5fa',
    fontFamily: "'-apple-system', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    dialogueBoxOpacity: 0.85,
    textAnimation: 'typewriter',
    fontSize: 16,
  },
  {
    id: 'paper-book',
    name: '纸质书',
    dialogueBoxStyle: 'classic',
    primaryColor: '#92400e',
    backgroundColor: '#f5e6c8',
    textColor: '#1f2937',
    accentColor: '#b45309',
    fontFamily: "'Noto Serif SC', 'Source Han Serif', 'Songti SC', serif",
    dialogueBoxOpacity: 0.95,
    textAnimation: 'fade',
    fontSize: 18,
  },
  {
    id: 'shoujo-manga',
    name: '少女漫',
    dialogueBoxStyle: 'modern',
    primaryColor: '#ec4899',
    backgroundColor: '#fdf2f8',
    textColor: '#831843',
    accentColor: '#f472b6',
    fontFamily: "'Mochiy Pop P One', 'Comic Sans MS', 'Yuanti SC', cursive",
    dialogueBoxOpacity: 0.9,
    textAnimation: 'slide',
    fontSize: 17,
  },
  {
    id: 'tech-neon',
    name: '科技风',
    dialogueBoxStyle: 'minimal',
    primaryColor: '#22d3ee',
    backgroundColor: '#030712',
    textColor: '#e5e7eb',
    accentColor: '#a855f7',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    dialogueBoxOpacity: 0.7,
    textAnimation: 'typewriter',
    fontSize: 15,
  },
  {
    id: 'classic-gold',
    name: '经典黑',
    dialogueBoxStyle: 'classic',
    primaryColor: '#fbbf24',
    backgroundColor: '#000000',
    textColor: '#f3e7b3',
    accentColor: '#f59e0b',
    fontFamily: "'Noto Serif SC', 'Source Han Serif', 'STKaiti', serif",
    dialogueBoxOpacity: 0.9,
    textAnimation: 'fade',
    fontSize: 18,
  },
]

// 根据主题生成 CSS 字符串（用于导出 HTML 注入）
export function themeToCSS(theme: ReaderTheme): string {
  const dialogueBoxBg =
    theme.dialogueBoxStyle === 'classic'
      ? `${theme.backgroundColor}`
      : theme.dialogueBoxStyle === 'modern'
      ? `rgba(0, 0, 0, ${theme.dialogueBoxOpacity})`
      : `rgba(0, 0, 0, ${Math.min(theme.dialogueBoxOpacity, 0.5)})`

  const borderRadius = theme.dialogueBoxStyle === 'classic' ? '0' : theme.dialogueBoxStyle === 'modern' ? '12px' : '4px'
  const borderWidth = theme.dialogueBoxStyle === 'classic' ? '2px' : '1px'

  return `
:root {
  --reader-primary: ${theme.primaryColor};
  --reader-bg: ${theme.backgroundColor};
  --reader-text: ${theme.textColor};
  --reader-accent: ${theme.accentColor};
  --reader-font: ${theme.fontFamily};
  --reader-font-size: ${theme.fontSize}px;
  --reader-box-bg: ${dialogueBoxBg};
  --reader-box-radius: ${borderRadius};
  --reader-box-border-width: ${borderWidth};
  --reader-box-opacity: ${theme.dialogueBoxOpacity};
  --reader-text-anim: ${theme.textAnimation};
}
body { background: var(--reader-bg) !important; color: var(--reader-text) !important; font-family: var(--reader-font) !important; }
.node { background: var(--reader-box-bg) !important; color: var(--reader-text) !important; border-radius: var(--reader-box-radius) !important; border-width: var(--reader-box-border-width) !important; }
.node-text { font-size: var(--reader-font-size) !important; }
.node-title { color: var(--reader-accent) !important; }
.choice-btn { background: var(--reader-box-bg) !important; color: var(--reader-text) !important; border-color: var(--reader-primary) !important; }
.choice-btn:hover { background: var(--reader-primary) !important; color: var(--reader-text) !important; }
.ending-badge.ending-good { background: var(--reader-primary) !important; color: var(--reader-text) !important; }
  `.trim()
}

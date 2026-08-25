/**
 * 手绘极简 SVG 插画集合（展位工作台空态/插画占位）
 * 纯内联 SVG，无外部依赖，支持响应式
 */
import React from 'react'

/** 陈列空态：空摊位插画（用于作品网格无内容） */
export function EmptyBoothSvg({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 220"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* 画布 / 地毯 */}
      <rect x="40" y="170" width="240" height="8" rx="4" fill="#c97b2d" fillOpacity="0.18" />
      {/* 顶棚伞 */}
      <path
        d="M60 80 Q160 30 260 80 L250 90 L70 90 Z"
        stroke="#c97b2d"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="#e8b04b"
        fillOpacity="0.18"
      />
      <path d="M160 34 L160 12" stroke="#c97b2d" strokeWidth="2" strokeLinecap="round" />
      {/* 摊位支柱 */}
      <line x1="70" y1="90" x2="70" y2="170" stroke="#8a7a67" strokeWidth="2" />
      <line x1="250" y1="90" x2="250" y2="170" stroke="#8a7a67" strokeWidth="2" />
      {/* 桌面 */}
      <rect x="60" y="120" width="200" height="6" rx="3" fill="#6b5f51" fillOpacity="0.6" />
      {/* 桌面上的空格子（没有本子） */}
      <rect x="90" y="100" width="30" height="20" rx="2" stroke="#dcd2c2" strokeWidth="1.5" strokeDasharray="3 2" fill="#fffdf9" fillOpacity="0.15" />
      <rect x="145" y="100" width="30" height="20" rx="2" stroke="#dcd2c2" strokeWidth="1.5" strokeDasharray="3 2" fill="#fffdf9" fillOpacity="0.15" />
      <rect x="200" y="100" width="30" height="20" rx="2" stroke="#dcd2c2" strokeWidth="1.5" strokeDasharray="3 2" fill="#fffdf9" fillOpacity="0.15" />
      {/* 店主小头像空位 */}
      <circle cx="160" cy="60" r="14" stroke="#dcd2c2" strokeWidth="1.5" strokeDasharray="3 2" fill="#fffdf9" fillOpacity="0.2" />
      <path d="M153 58 Q160 53 167 58 M160 58 L160 67 M155 67 Q160 71 165 67"
        stroke="#9a8c7a" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeDasharray="2 1.5" />
      {/* 闪光 */}
      <path d="M40 130 l3 0 M40 150 l3 0 M282 125 l-3 0 M282 145 l-3 0"
        stroke="#c97b2d" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}

/** 预览空态：单册待选 */
export function EmptyPreviewSvg({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 260"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="20" y="30" width="160" height="210" rx="12" stroke="#dcd2c2" strokeWidth="1.5" strokeDasharray="4 3" fill="#fffdf9" fillOpacity="0.15" />
      <rect x="35" y="50" width="130" height="70" rx="6" stroke="#dcd2c2" strokeWidth="1" strokeDasharray="3 2" fill="none" />
      <line x1="40" y1="140" x2="160" y2="140" stroke="#dcd2c2" strokeWidth="1" strokeDasharray="3 2" />
      <line x1="40" y1="158" x2="140" y2="158" stroke="#dcd2c2" strokeWidth="1" strokeDasharray="3 2" />
      <line x1="40" y1="176" x2="150" y2="176" stroke="#dcd2c2" strokeWidth="1" strokeDasharray="3 2" />
      <line x1="40" y1="194" x2="120" y2="194" stroke="#dcd2c2" strokeWidth="1" strokeDasharray="3 2" />
      <text x="100" y="228" textAnchor="middle" fontSize="10" fill="#9a8c7a" fontFamily="inherit">
        点击左侧任意作品
      </text>
    </svg>
  )
}

/** 下载渠道空态：云 + 文件夹插画 */
export function EmptyDownloadSvg({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 260 160"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* 云 */}
      <path
        d="M60 100 Q40 100 40 84 Q40 68 60 68 Q62 52 80 52 Q98 52 100 68 Q122 68 122 86 Q122 100 102 100 Z"
        stroke="#3f7fc9" strokeWidth="1.5" fill="#3f7fc9" fillOpacity="0.08"
      />
      {/* 文件夹 */}
      <path d="M160 68 h-28 l-10 -10 h-26 a4 4 0 0 0 -4 4 v42 a4 4 0 0 0 4 4 h68 a4 4 0 0 0 4 -4 v-26 a4 4 0 0 0 -4 -4 h-4 z"
        stroke="#c97b2d" strokeWidth="1.5" fill="#e8b04b" fillOpacity="0.12" />
      {/* 连接箭头 */}
      <path d="M130 84 L156 84 M148 78 L156 84 L148 90"
        stroke="#9a8c7a" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* 空态提示小点 */}
      <circle cx="200" cy="120" r="1.5" fill="#9a8c7a" fillOpacity="0.5" />
      <circle cx="210" cy="120" r="1.5" fill="#9a8c7a" fillOpacity="0.5" />
      <circle cx="220" cy="120" r="1.5" fill="#9a8c7a" fillOpacity="0.5" />
    </svg>
  )
}

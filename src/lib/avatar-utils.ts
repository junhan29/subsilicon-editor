// 生成角色默认头像（首字母 + 颜色）
export function generateDefaultAvatar(name: string, color: string): string {
  const initial = name.charAt(0).toUpperCase() || 'X'
  
  // 创建 SVG
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="${color}"/>
      <text x="50" y="50" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">${initial}</text>
    </svg>
  `
  
  // 转换为 data URL
  return `data:image/svg+xml,${encodeURIComponent(svg.trim())}`
}
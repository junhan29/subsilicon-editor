'use client'

interface BarChartProps {
  data: Array<{ label: string; value: number; color?: string }>
  maxValue?: number
  height?: number
  barWidth?: number
  gap?: number
  showLabels?: boolean
  showValues?: boolean
}

export function BarChart({
  data,
  maxValue,
  height = 120,
  barWidth = 32,
  gap = 8,
  showLabels = true,
  showValues = true,
}: BarChartProps) {
  if (data.length === 0) return null

  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1)
  const chartWidth = data.length * (barWidth + gap) + gap
  const chartHeight = height + (showLabels ? 24 : 0) + (showValues ? 20 : 0)
  const barAreaHeight = height - 20

  return (
    <svg
      width={chartWidth}
      height={chartHeight}
      className="overflow-visible"
      role="img"
      aria-label="柱状图"
    >
      {/* Y 轴刻度 */}
      <line x1={gap} y1={10} x2={chartWidth - gap} y2={10} stroke="#374151" strokeWidth="1" strokeDasharray="2,2" />
      <text x={gap - 4} y={12} fontSize="8" fill="#9CA3AF" textAnchor="end">{max}</text>
      <line x1={gap} y1={barAreaHeight / 2 + 10} x2={chartWidth - gap} y2={barAreaHeight / 2 + 10} stroke="#374151" strokeWidth="1" strokeDasharray="2,2" />
      <text x={gap - 4} y={barAreaHeight / 2 + 12} fontSize="8" fill="#9CA3AF" textAnchor="end">{Math.round(max / 2)}</text>
      <line x1={gap} y1={barAreaHeight + 10} x2={chartWidth - gap} y2={barAreaHeight + 10} stroke="#374151" strokeWidth="1" />

      {data.map((d, i) => {
        const barHeight = Math.max((d.value / max) * barAreaHeight, 2)
        const x = gap + i * (barWidth + gap) + barWidth / 2
        const y = barAreaHeight + 10 - barHeight
        const color = d.color || '#F59E0B'

        return (
          <g key={i}>
            {/* 柱子 */}
            <rect
              x={x - barWidth / 2}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={color}
              rx={4}
              ry={4}
              className="transition-all duration-300"
            />
            {/* 数值 */}
            {showValues && (
              <text
                x={x}
                y={y - 4}
                fontSize="10"
                fill="#E5E7EB"
                textAnchor="middle"
                fontWeight="600"
              >
                {d.value}
              </text>
            )}
            {/* 标签 */}
            {showLabels && (
              <text
                x={x}
                y={barAreaHeight + 24}
                fontSize="8"
                fill="#9CA3AF"
                textAnchor="middle"
              >
                {d.label.length > 6 ? d.label.slice(0, 6) + '..' : d.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

interface PieChartProps {
  data: Array<{ label: string; value: number; color?: string }>
  size?: number
  showLabels?: boolean
  innerRadius?: number
}

export function PieChart({
  data,
  size = 160,
  showLabels = true,
  innerRadius = 0,
}: PieChartProps) {
  if (data.length === 0) return null

  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) return null

  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - (showLabels ? 24 : 4)
  const colors = ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EF4444', '#EC4899', '#6366F1', '#14B8A6']

  let currentAngle = -90

  const segments = data.map((d, i) => {
    const angle = (d.value / total) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle

    const color = d.color || colors[i % colors.length]
    const percentage = (d.value / total) * 100

    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180

    const x1 = cx + radius * Math.cos(startRad)
    const y1 = cy + radius * Math.sin(startRad)
    const x2 = cx + radius * Math.cos(endRad)
    const y2 = cy + radius * Math.sin(endRad)

    const largeArc = angle > 180 ? 1 : 0

    let path: string
    if (innerRadius > 0) {
      const innerX1 = cx + innerRadius * Math.cos(startRad)
      const innerY1 = cy + innerRadius * Math.sin(startRad)
      const innerX2 = cx + innerRadius * Math.cos(endRad)
      const innerY2 = cy + innerRadius * Math.sin(endRad)

      path = `
        M ${x1} ${y1}
        A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
        L ${innerX2} ${innerY2}
        A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerX1} ${innerY1}
        Z
      `
    } else {
      path = `
        M ${cx} ${cy}
        L ${x1} ${y1}
        A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
        Z
      `
    }

    // 标签位置（在扇形外侧）
    const midAngle = (startAngle + endAngle) / 2
    const midRad = (midAngle * Math.PI) / 180
    const labelRadius = radius + 16
    const labelX = cx + labelRadius * Math.cos(midRad)
    const labelY = cy + labelRadius * Math.sin(midRad)

    return {
      path,
      color,
      label: d.label,
      percentage,
      labelX,
      labelY,
      value: d.value,
    }
  })

  return (
    <svg
      width={size}
      height={size}
      className="overflow-visible"
      role="img"
      aria-label="饼图"
    >
      {segments.map((seg, i) => (
        <g key={i}>
          <path
            d={seg.path}
            fill={seg.color}
            stroke="#1F2937"
            strokeWidth="1"
            className="transition-all duration-300 hover:opacity-80"
          />
          {showLabels && seg.percentage > 5 && (
            <text
              x={seg.labelX}
              y={seg.labelY}
              fontSize="9"
              fill="#E5E7EB"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {seg.percentage.toFixed(0)}%
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  showDots?: boolean
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = '#F59E0B',
  showDots = false,
}: SparklineProps) {
  if (data.length < 2) return null

  const max = Math.max(...data, 1)
  const min = Math.min(...data)
  const range = max - min || 1

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  })

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDots &&
        data.map((v, i) => {
          const x = (i / (data.length - 1)) * width
          const y = height - ((v - min) / range) * (height - 4) - 2
          return <circle key={i} cx={x} cy={y} r="2" fill={color} />
        })}
    </svg>
  )
}
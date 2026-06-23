/**
 * Sparkline — 인라인 SVG 스파크라인 컴포넌트
 * 외부 차트 라이브러리 없이 순수 SVG polyline으로 구현.
 * 인터랙션 없는 순수 표시용이므로 "use client" 없음.
 */

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
}

const Sparkline = ({ data, width = 80, height = 24 }: SparklineProps) => {
  if (!data || data.length < 2) {
    // 데이터 없거나 1개 이하면 빈 SVG(flat line)
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#d1d5db"
          strokeWidth={1}
        />
      </svg>
    )
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1 // 0으로 나누기 방지

  const padding = 2
  const innerW = width - padding * 2
  const innerH = height - padding * 2

  const points = data
    .map((v, i) => {
      const x = padding + (i / (data.length - 1)) * innerW
      // y: max가 위(padding), min이 아래(height-padding)
      const y = padding + ((max - v) / range) * innerH
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="#6366f1"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default Sparkline

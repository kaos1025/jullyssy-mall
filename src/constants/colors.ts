export const COLOR_MAP: Record<string, string> = {
  멜란지그레이: "#B0B0B0",
  스카이블루: "#87CEEB",
  라이트그레이: "#C0C0C0",
  연브라운: "#B8956A",
  진브라운: "#5C3A1E",
  딥그린: "#2E5A3E",
  머스타드: "#C9A832",
  연핑크: "#F5C6D0",
  블랙: "#000000",
  화이트: "#FFFFFF",
  아이보리: "#FFFFF0",
  크림: "#FFFDD0",
  베이지: "#F5F5DC",
  카멜: "#C19A6B",
  브라운: "#8B4513",
  네이비: "#000080",
  그레이: "#808080",
  차콜: "#36454F",
  카키: "#BDB76B",
  레드: "#DC143C",
  핑크: "#FFB6C1",
  와인: "#722F37",
  버건디: "#800020",
  블루: "#4169E1",
  소라: "#A0D2DB",
  라벤더: "#E6E6FA",
  민트: "#98FF98",
  옐로우: "#FFD700",
  오렌지: "#FF8C00",
  살구: "#FBCEB1",
  퍼플: "#7B4F8A",
  그린: "#5A8F5A",
  올리브: "#6B7B5E",
}

export const DEFAULT_COLOR = "linear-gradient(135deg, #ddd 50%, #bbb 50%)"

// 긴 키부터 먼저 매칭 (멜란지그레이 > 그레이)
const sortedEntries = Object.entries(COLOR_MAP).sort(
  ([a], [b]) => b.length - a.length
)

export const getColorStyle = (
  colorName: string
): { backgroundColor?: string; backgroundImage?: string } => {
  const match = sortedEntries.find(([key]) => colorName.includes(key))
  if (match) return { backgroundColor: match[1] }
  return { backgroundImage: DEFAULT_COLOR }
}

export const isLightColor = (colorName: string): boolean => {
  const lightColors = [
    "화이트",
    "아이보리",
    "크림",
    "베이지",
    "연핑크",
    "살구",
    "옐로우",
    "민트",
    "라벤더",
  ]
  return lightColors.some((c) => colorName.includes(c))
}

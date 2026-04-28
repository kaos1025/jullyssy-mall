import type {
  ReviewWithImages,
  ReviewTagSize,
  ReviewTagColor,
  ReviewTagThickness,
  ReviewTagStretch,
} from "@/types"

export type ReviewTagAxis = "size" | "color" | "thickness" | "stretch"

export type ReviewTagOption =
  | ReviewTagSize
  | ReviewTagColor
  | ReviewTagThickness
  | ReviewTagStretch

export interface ReviewTagSummaryRow {
  axis: ReviewTagAxis
  option: ReviewTagOption
  count: number
  percentage: number
}

export interface ReviewTagAxisSummary {
  axis: ReviewTagAxis
  label: string
  total: number
  options: {
    option: ReviewTagOption
    count: number
    percentage: number
    isTop: boolean
  }[]
}

export interface ReviewTagSelection {
  tag_size: ReviewTagSize | null
  tag_color: ReviewTagColor | null
  tag_thickness: ReviewTagThickness | null
  tag_stretch: ReviewTagStretch | null
}

export const REVIEW_TAG_AXIS_LABELS: Record<ReviewTagAxis, string> = {
  size: "사이즈",
  color: "컬러",
  thickness: "두께",
  stretch: "신축성",
}

export const REVIEW_TAG_OPTIONS: Record<ReviewTagAxis, ReviewTagOption[]> = {
  size: ["약간 작아요", "딱 맞아요", "약간 커요"],
  color: ["화면보다 어두워요", "화면과 똑같아요", "화면보다 밝아요"],
  thickness: ["얇아요", "적당해요", "두꺼워요"],
  stretch: ["없어요", "적당해요", "많이 있어요"],
}

export const REVIEW_TAG_AXIS_ORDER: ReviewTagAxis[] = [
  "size",
  "color",
  "thickness",
  "stretch",
]

export type { ReviewWithImages }

"use client"

import { cn } from "@/lib/utils"
import {
  REVIEW_TAG_AXIS_LABELS,
  REVIEW_TAG_AXIS_ORDER,
  REVIEW_TAG_OPTIONS,
  type ReviewTagAxis,
  type ReviewTagOption,
  type ReviewTagSelection,
} from "@/types/review"

interface ReviewTagSelectorProps {
  value: ReviewTagSelection
  onChange: (next: ReviewTagSelection) => void
  required?: boolean
}

const FIELD_KEY: Record<ReviewTagAxis, keyof ReviewTagSelection> = {
  size: "tag_size",
  color: "tag_color",
  thickness: "tag_thickness",
  stretch: "tag_stretch",
}

const ReviewTagSelector = ({
  value,
  onChange,
  required = false,
}: ReviewTagSelectorProps) => {
  const handleSelect = (axis: ReviewTagAxis, option: ReviewTagOption) => {
    const key = FIELD_KEY[axis]
    const current = value[key]
    onChange({
      ...value,
      // 같은 옵션 다시 클릭 시 선택 해제 (선택 사항이므로 비울 수 있어야 함)
      [key]: current === option ? null : option,
    } as ReviewTagSelection)
  }

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-medium">
        착용 평가
        {required ? (
          <span className="ml-1 text-primary">*</span>
        ) : (
          <span className="ml-1 text-xs text-muted-foreground">(선택)</span>
        )}
      </legend>

      <div className="space-y-3">
        {REVIEW_TAG_AXIS_ORDER.map((axis) => {
          const key = FIELD_KEY[axis]
          const selected = value[key]
          return (
            <div key={axis} className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                {REVIEW_TAG_AXIS_LABELS[axis]}
              </p>
              <div
                role="radiogroup"
                aria-label={REVIEW_TAG_AXIS_LABELS[axis]}
                className="grid grid-cols-3 gap-1.5"
              >
                {REVIEW_TAG_OPTIONS[axis].map((option) => {
                  const isActive = selected === option
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => handleSelect(axis, option)}
                      className={cn(
                        "rounded-md border px-2 py-2 text-xs transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                        isActive
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background text-foreground hover:bg-muted"
                      )}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}

export default ReviewTagSelector

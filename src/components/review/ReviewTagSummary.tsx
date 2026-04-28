import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import {
  REVIEW_TAG_AXIS_LABELS,
  REVIEW_TAG_AXIS_ORDER,
  REVIEW_TAG_OPTIONS,
  type ReviewTagAxisSummary,
  type ReviewTagSummaryRow,
} from "@/types/review"

interface ReviewTagSummaryProps {
  rows: ReviewTagSummaryRow[]
  reviewCount: number
}

const groupByAxis = (rows: ReviewTagSummaryRow[]): ReviewTagAxisSummary[] => {
  return REVIEW_TAG_AXIS_ORDER.map((axis) => {
    const axisRows = rows.filter((r) => r.axis === axis)
    const total = axisRows.reduce((sum, r) => sum + r.count, 0)
    const maxCount = Math.max(0, ...axisRows.map((r) => r.count))
    const ordered = REVIEW_TAG_OPTIONS[axis].map((option) => {
      const row = axisRows.find((r) => r.option === option)
      const count = row?.count ?? 0
      return {
        option,
        count,
        percentage: row?.percentage ?? 0,
        isTop: count > 0 && count === maxCount,
      }
    })
    return {
      axis,
      label: REVIEW_TAG_AXIS_LABELS[axis],
      total,
      options: ordered,
    }
  })
}

const AxisBlock = ({ summary }: { summary: ReviewTagAxisSummary }) => (
  <div className="space-y-3">
    <div className="flex items-baseline justify-between">
      <h3 className="text-sm font-semibold">{summary.label}</h3>
      <span className="text-xs text-muted-foreground">
        응답 {summary.total}
      </span>
    </div>
    <ul className="space-y-2">
      {summary.options.map((opt) => (
        <li key={opt.option} className="space-y-1">
          <div className="flex items-baseline justify-between text-xs">
            <span
              className={cn(
                opt.isTop ? "font-semibold text-primary" : "text-foreground"
              )}
            >
              {opt.option}
            </span>
            <span
              className={cn(
                "tabular-nums",
                opt.isTop ? "text-primary font-medium" : "text-muted-foreground"
              )}
            >
              {opt.percentage.toFixed(0)}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-[width]",
                opt.isTop ? "bg-primary" : "bg-secondary"
              )}
              style={{ width: `${Math.min(100, opt.percentage)}%` }}
              aria-hidden
            />
          </div>
        </li>
      ))}
    </ul>
  </div>
)

const ReviewTagSummary = ({ rows, reviewCount }: ReviewTagSummaryProps) => {
  const grouped = groupByAxis(rows)
  const hasAnyResponse = grouped.some((g) => g.total > 0)

  return (
    <section
      aria-labelledby="review-fit-fabric-title"
      className="mt-12"
    >
      <header className="mb-4 flex items-baseline justify-between">
        <div className="space-y-1">
          <p className="font-display text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Fit &amp; Fabric
          </p>
          <h2
            id="review-fit-fabric-title"
            className="text-base font-bold md:text-lg"
          >
            구매자 평가 요약
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">
          리뷰 {reviewCount.toLocaleString()}개 기준
        </span>
      </header>

      <Card className="border-border shadow-sm">
        <CardContent className="p-4 md:p-6">
          {hasAnyResponse ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-x-10 md:gap-y-6">
              {grouped.map((summary) => (
                <AxisBlock key={summary.axis} summary={summary} />
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              아직 평가 응답이 충분하지 않아요.
            </p>
          )}
          <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
            오렌지 막대가 가장 많이 선택된 항목이에요.
          </p>
        </CardContent>
      </Card>
    </section>
  )
}

export default ReviewTagSummary

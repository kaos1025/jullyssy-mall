"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

const MAX_HEIGHT = 600

const ProductDescription = ({ html }: { html: string }) => {
  const [expanded, setExpanded] = useState(false)
  const [needsToggle, setNeedsToggle] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (contentRef.current) {
      setNeedsToggle(contentRef.current.scrollHeight > MAX_HEIGHT)
    }
  }, [html])

  const handleToggle = () => {
    if (expanded) {
      // 접기 시 섹션 상단으로 스크롤
      contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
    setExpanded((prev) => !prev)
  }

  return (
    <div className="relative">
      <div
        ref={contentRef}
        className="prose prose-sm max-w-none overflow-hidden transition-[max-height] duration-500"
        style={{ maxHeight: expanded || !needsToggle ? "none" : `${MAX_HEIGHT}px` }}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* 그라데이션 오버레이 + 더보기 버튼 */}
      {needsToggle && (
        <div
          className={
            expanded
              ? "flex justify-center pt-4"
              : "absolute bottom-0 left-0 right-0 flex flex-col items-center"
          }
        >
          {!expanded && (
            <div className="w-full h-20 bg-gradient-to-t from-white to-transparent" />
          )}
          <button
            onClick={handleToggle}
            className="flex items-center gap-1 bg-white border rounded-full px-6 py-2 text-sm text-muted-foreground hover:text-foreground shadow-sm transition-colors"
          >
            {expanded ? (
              <>
                상세정보 접기 <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                상세정보 더보기 <ChevronDown className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export default ProductDescription

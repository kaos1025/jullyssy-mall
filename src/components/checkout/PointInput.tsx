"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

interface PointInputProps {
  orderAmount: number
  onApply: (point: number) => void
}

const MIN_POINT = 1000
const MAX_POINT_RATIO = 0.5

const PointInput = ({ orderAmount, onApply }: PointInputProps) => {
  const [availablePoint, setAvailablePoint] = useState(0)
  const [inputValue, setInputValue] = useState("")

  useEffect(() => {
    const fetchPoint = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("profiles")
        .select("point")
        .eq("id", user.id)
        .single()

      if (data) setAvailablePoint(data.point)
    }
    fetchPoint()
  }, [])

  const maxUsable = Math.min(
    availablePoint,
    Math.floor(orderAmount * MAX_POINT_RATIO)
  )

  const handleApply = () => {
    const value = parseInt(inputValue, 10)
    if (isNaN(value) || value < MIN_POINT) {
      onApply(0)
      setInputValue("")
      return
    }
    const clamped = Math.min(value, maxUsable)
    setInputValue(String(clamped))
    onApply(clamped)
  }

  const handleUseAll = () => {
    if (maxUsable < MIN_POINT) return
    setInputValue(String(maxUsable))
    onApply(maxUsable)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">포인트</h3>
        <span className="text-sm text-muted-foreground">
          보유 {availablePoint.toLocaleString()}P
        </span>
      </div>
      <div className="flex gap-2">
        <Input
          type="number"
          placeholder={`최소 ${MIN_POINT.toLocaleString()}P`}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="flex-1"
        />
        <Button variant="outline" size="sm" onClick={handleApply}>
          적용
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleUseAll}
          disabled={maxUsable < MIN_POINT}
        >
          전액사용
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        최소 {MIN_POINT.toLocaleString()}P 이상, 결제금액의 최대 50%까지 사용
        가능
      </p>
    </div>
  )
}

export default PointInput

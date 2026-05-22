"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

interface OrderCancelButtonProps {
  orderId: string
}

export const OrderCancelButton = ({ orderId }: OrderCancelButtonProps) => {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleCancel = async () => {
    setLoading(true)

    const res = await fetch(`/api/orders/${orderId}/cancel`, {
      method: "POST",
    })

    if (res.ok) {
      toast({
        title: "주문이 취소되었습니다",
      })
      setOpen(false)
      router.refresh()
    } else {
      const err = await res.json()
      toast({
        variant: "destructive",
        title: "취소 실패",
        description: err.error,
      })
    }

    setLoading(false)
  }

  return (
    <>
      {/* P1-26: 카드 줄2 한 줄 유지 + "결제 직후 취소"는 자주 발생 X → ghost로 시각 약화. */}
      <Button
        variant="ghost"
        size="sm"
        className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
      >
        취소
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>주문을 취소하시겠습니까?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            취소된 주문은 복구할 수 없으며, 결제금액이 환불됩니다.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              닫기
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={loading}
            >
              {loading ? "처리 중..." : "취소 신청"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

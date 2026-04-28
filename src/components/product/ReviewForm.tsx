"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import ReviewFormBody from "./ReviewFormBody"

interface ReviewFormProps {
  productId: string
  orderItemId: string
  productName: string
  trigger?: React.ReactNode
}

const ReviewForm = ({
  productId,
  orderItemId,
  productName,
  trigger,
}: ReviewFormProps) => {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline" size="sm">리뷰 작성</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>리뷰 작성</DialogTitle>
        </DialogHeader>
        <ReviewFormBody
          productId={productId}
          orderItemId={orderItemId}
          productName={productName}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

export default ReviewForm

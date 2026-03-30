"use client"

import { useState } from "react"
import { Star, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

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
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rating, setRating] = useState(5)
  const [content, setContent] = useState("")
  const [height, setHeight] = useState("")
  const [weight, setWeight] = useState("")
  const [purchasedSize, setPurchasedSize] = useState("")
  const [images, setImages] = useState<File[]>([])

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({ variant: "destructive", title: "별점을 선택해주세요" })
      return
    }

    setLoading(true)
    const formData = new FormData()
    formData.append("product_id", productId)
    formData.append("order_item_id", orderItemId)
    formData.append("rating", String(rating))
    formData.append("content", content)
    if (height) formData.append("height", height)
    if (weight) formData.append("weight", weight)
    if (purchasedSize) formData.append("purchased_size", purchasedSize)
    images.forEach((file) => formData.append("images", file))

    const res = await fetch("/api/reviews", {
      method: "POST",
      body: formData,
    })

    if (res.ok) {
      const data = await res.json()
      toast({
        title: "리뷰가 등록되었습니다",
        description: `${data.point_reward}P 적립되었습니다.`,
      })
      setOpen(false)
      setContent("")
      setImages([])
    } else {
      const err = await res.json()
      toast({ variant: "destructive", title: "리뷰 작성 실패", description: err.error })
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline" size="sm">리뷰 작성</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>리뷰 작성</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground line-clamp-1">
          {productName}
        </p>

        <div className="space-y-4">
          {/* 별점 */}
          <div>
            <Label>별점</Label>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                >
                  <Star
                    className={cn(
                      "h-6 w-6",
                      star <= rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* 텍스트 */}
          <div>
            <Label>리뷰 내용</Label>
            <textarea
              className="w-full min-h-[100px] border rounded-md p-3 text-sm resize-y mt-1"
              placeholder="착용감, 사이즈, 색상 등을 자유롭게 작성해주세요"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {/* 이미지 */}
          <div>
            <Label
              htmlFor="review-images"
              className="flex items-center gap-2 border border-dashed rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                사진 첨부 (최대 3장) — 포토리뷰 500P, 일반리뷰 100P
              </span>
            </Label>
            <input
              id="review-images"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  setImages(Array.from(e.target.files).slice(0, 3))
                }
              }}
            />
            {images.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {images.length}장 선택됨
              </p>
            )}
          </div>

          {/* 체형 정보 (선택) */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">키 (cm)</Label>
              <Input
                type="number"
                placeholder="165"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">몸무게 (kg)</Label>
              <Input
                type="number"
                placeholder="55"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">구매사이즈</Label>
              <Input
                placeholder="M"
                value={purchasedSize}
                onChange={(e) => setPurchasedSize(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleSubmit} className="w-full" disabled={loading}>
            {loading ? "등록 중..." : "리뷰 등록"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ReviewForm

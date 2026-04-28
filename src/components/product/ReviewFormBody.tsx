"use client"

import { useState, useEffect, useRef, type ChangeEvent } from "react"
import Image from "next/image"
import { Star, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import ReviewTagSelector from "@/components/review/ReviewTagSelector"
import type { ReviewTagSelection } from "@/types/review"

const EMPTY_TAGS: ReviewTagSelection = {
  tag_size: null,
  tag_color: null,
  tag_thickness: null,
  tag_stretch: null,
}

const MAX_IMAGES = 3
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIMES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]

interface AttachedImage {
  file: File
  previewUrl: string
  id: string
}

interface ReviewFormBodyProps {
  productId: string
  orderItemId: string
  productName: string
  onSuccess?: (data: {
    review_id: string
    point_reward: number
    uploaded_count?: number
    upload_errors?: string[]
  }) => void
  showProductName?: boolean
  showToast?: boolean
}

const ReviewFormBody = ({
  productId,
  orderItemId,
  productName,
  onSuccess,
  showProductName = true,
  showToast = true,
}: ReviewFormBodyProps) => {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [rating, setRating] = useState(5)
  const [content, setContent] = useState("")
  const [height, setHeight] = useState("")
  const [weight, setWeight] = useState("")
  const [purchasedSize, setPurchasedSize] = useState("")
  const [images, setImages] = useState<AttachedImage[]>([])
  const [tags, setTags] = useState<ReviewTagSelection>(EMPTY_TAGS)

  // unmount 시 남아있는 blob URL 정리 — ref 로 최신 images 추적 (stale closure 회피)
  const imagesRef = useRef<AttachedImage[]>([])
  useEffect(() => {
    imagesRef.current = images
  }, [images])
  useEffect(() => {
    return () => {
      imagesRef.current.forEach((img) => URL.revokeObjectURL(img.previewUrl))
    }
  }, [])

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = "" // 같은 파일 재선택 가능

    const remainingSlots = MAX_IMAGES - images.length
    if (remainingSlots <= 0) {
      toast({
        title: `최대 ${MAX_IMAGES}장까지 첨부할 수 있어요`,
        variant: "destructive",
      })
      return
    }

    const accepted: AttachedImage[] = []
    const rejected: string[] = []

    for (const file of files.slice(0, remainingSlots)) {
      if (!ALLOWED_MIMES.includes(file.type)) {
        rejected.push(`${file.name}: JPG, PNG, WebP만 가능`)
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        rejected.push(`${file.name}: 5MB 초과`)
        continue
      }
      accepted.push({
        file,
        previewUrl: URL.createObjectURL(file),
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      })
    }

    if (rejected.length > 0) {
      toast({
        title: "일부 사진을 첨부할 수 없어요",
        description: rejected.join("\n"),
        variant: "destructive",
      })
    }

    setImages((prev) => [...prev, ...accepted])

    if (files.length > remainingSlots) {
      toast({
        title: `${MAX_IMAGES}장 초과로 ${files.length - remainingSlots}장은 추가되지 않았어요`,
      })
    }
  }

  const handleRemoveImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((img) => img.id !== id)
    })
  }

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
    if (tags.tag_size) formData.append("tag_size", tags.tag_size)
    if (tags.tag_color) formData.append("tag_color", tags.tag_color)
    if (tags.tag_thickness) formData.append("tag_thickness", tags.tag_thickness)
    if (tags.tag_stretch) formData.append("tag_stretch", tags.tag_stretch)
    images.forEach((img) => formData.append("images", img.file))

    const res = await fetch("/api/reviews", {
      method: "POST",
      body: formData,
    })

    if (res.ok) {
      const data = await res.json()
      if (showToast) {
        toast({
          title: "리뷰가 등록되었습니다",
          description: `${data.point_reward}P 적립되었습니다.`,
        })
      }
      // 성공 시 blob URL 즉시 해제 (unmount 전 미리)
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl))
      setContent("")
      setImages([])
      setTags(EMPTY_TAGS)
      onSuccess?.(data)
    } else {
      const err = await res.json()
      toast({ variant: "destructive", title: "리뷰 작성 실패", description: err.error })
    }

    setLoading(false)
  }

  const isLimitReached = images.length >= MAX_IMAGES

  return (
    <>
      {showProductName && (
        <p className="text-sm text-muted-foreground line-clamp-1">
          {productName}
        </p>
      )}

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

        {/* 4축 태그 선택 (별점 다음, 사진 첨부 전) */}
        <ReviewTagSelector value={tags} onChange={setTags} />

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

        {/* 이미지 첨부 */}
        <div>
          <label
            className={cn(
              "border border-dashed border-gray-300 rounded-lg p-4 flex items-center gap-2 transition",
              isLimitReached
                ? "opacity-50 cursor-not-allowed"
                : "cursor-pointer hover:border-gray-400"
            )}
          >
            <Upload size={16} strokeWidth={1.5} />
            <span className="text-sm">
              사진 첨부 ({images.length} / {MAX_IMAGES}) — 포토리뷰 500P, 일반리뷰 100P
            </span>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              disabled={isLimitReached}
            />
          </label>
          <p className="mt-1 text-xs text-gray-500">
            JPG, PNG, WebP · 5MB 이하
          </p>

          {images.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((img, idx) => (
                <div
                  key={img.id}
                  className="relative aspect-square rounded-lg overflow-hidden bg-gray-100"
                >
                  <Image
                    src={img.previewUrl}
                    alt={`첨부 이미지 ${idx + 1}`}
                    fill
                    sizes="(max-width: 640px) 33vw, 25vw"
                    className="object-cover"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(img.id)}
                    aria-label="이미지 제거"
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition"
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
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
    </>
  )
}

export default ReviewFormBody

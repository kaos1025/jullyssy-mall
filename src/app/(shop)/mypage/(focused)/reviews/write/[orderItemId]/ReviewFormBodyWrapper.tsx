"use client"

import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import ReviewFormBody from "@/components/product/ReviewFormBody"

interface Props {
  productId: string
  orderItemId: string
  productName: string
}

const ReviewFormBodyWrapper = ({
  productId,
  orderItemId,
  productName,
}: Props) => {
  const router = useRouter()
  const { toast } = useToast()

  const handleSuccess = (data: {
    review_id: string
    point_reward: number
    uploaded_count?: number
    upload_errors?: string[]
  }) => {
    const failedCount = data.upload_errors?.length ?? 0
    if (failedCount > 0) {
      toast({
        variant: "destructive",
        title: "리뷰는 등록됐지만 일부 사진 업로드 실패",
        description: `${data.point_reward.toLocaleString()}P 적립. ${failedCount}장 사진 업로드 실패.`,
      })
    } else {
      toast({
        title: "리뷰가 등록되었습니다",
        description: `${data.point_reward.toLocaleString()}P 적립되었어요`,
      })
    }
    router.push("/mypage/reviews?tab=written")
    router.refresh()
  }

  return (
    <ReviewFormBody
      productId={productId}
      orderItemId={orderItemId}
      productName={productName}
      showProductName={false}
      showToast={false}
      onSuccess={handleSuccess}
    />
  )
}

export default ReviewFormBodyWrapper

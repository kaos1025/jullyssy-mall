"use client"

import { useRouter } from "next/navigation"
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

  const handleSuccess = () => {
    router.push("/mypage/reviews?tab=written")
    router.refresh()
  }

  return (
    <ReviewFormBody
      productId={productId}
      orderItemId={orderItemId}
      productName={productName}
      showProductName={false}
      onSuccess={handleSuccess}
    />
  )
}

export default ReviewFormBodyWrapper

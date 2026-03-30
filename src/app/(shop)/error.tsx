"use client"

import { Button } from "@/components/ui/button"

const ShopError = ({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) => {
  return (
    <div className="container py-20 text-center">
      <h2 className="text-xl font-bold mb-4">문제가 발생했습니다</h2>
      <p className="text-muted-foreground mb-6">
        {error.message || "알 수 없는 오류가 발생했습니다."}
      </p>
      <Button onClick={reset}>다시 시도</Button>
    </div>
  )
}

export default ShopError

"use client"

import { Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

interface ShareButtonProps {
  title: string
  text: string
}

const ShareButton = ({ title, text }: ShareButtonProps) => {
  const { toast } = useToast()

  const handleShare = async () => {
    const url = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
        return
      } catch {
        // 사용자가 공유 취소 — 무시
        return
      }
    }

    // Web Share API 미지원 — 클립보드 복사
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: "링크가 복사되었습니다" })
    } catch {
      toast({ variant: "destructive", title: "복사에 실패했습니다" })
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full"
      onClick={handleShare}
      aria-label="공유하기"
    >
      <Share2 className="h-5 w-5" strokeWidth={1.5} />
    </Button>
  )
}

export default ShareButton

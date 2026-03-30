"use client"

import { useState } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

const NaverImportButton = () => {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleImport = async () => {
    if (!confirm("스마트스토어 상품을 임포트합니다. 진행하시겠습니까?")) return

    setLoading(true)
    const res = await fetch("/api/naver/import", { method: "POST" })
    const data = await res.json()

    if (res.ok) {
      toast({
        title: "임포트 완료",
        description: `총 ${data.total}건 중 성공 ${data.success}건, 실패 ${data.fail}건`,
      })
    } else {
      toast({
        variant: "destructive",
        title: "임포트 실패",
        description: data.error,
      })
    }

    setLoading(false)
  }

  return (
    <Button variant="outline" onClick={handleImport} disabled={loading}>
      <Upload className="h-4 w-4 mr-2" />
      {loading ? "임포트 중..." : "스마트스토어 임포트"}
    </Button>
  )
}

export default NaverImportButton

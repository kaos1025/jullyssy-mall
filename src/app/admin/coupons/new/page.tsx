"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"

const NewCouponPage = () => {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    name: "",
    code: "",
    type: "FIXED" as "FIXED" | "PERCENT",
    discount_value: 0,
    min_order_amount: 0,
    max_discount: 0,
    starts_at: "",
    expires_at: "",
    max_issues: 0,
  })

  const updateField = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.name || !form.code || !form.discount_value || !form.starts_at || !form.expires_at) {
      toast({ variant: "destructive", title: "필수 항목을 입력해주세요" })
      return
    }

    setLoading(true)

    const res = await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        code: form.code.toUpperCase(),
        type: form.type,
        discount_value: form.discount_value,
        min_order_amount: form.min_order_amount || 0,
        max_discount: form.max_discount || null,
        starts_at: new Date(form.starts_at).toISOString(),
        expires_at: new Date(form.expires_at).toISOString(),
        max_issues: form.max_issues || null,
      }),
    })

    const data = await res.json()

    if (data.error) {
      toast({
        variant: "destructive",
        title: "쿠폰 생성 실패",
        description: data.error,
      })
    } else {
      toast({ title: "쿠폰이 생성되었습니다" })
      router.push("/admin/coupons")
    }

    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">쿠폰 생성</h1>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
        <div>
          <Label>쿠폰명 *</Label>
          <Input
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="예: 신규회원 10% 할인"
            required
          />
        </div>

        <div>
          <Label>쿠폰 코드 *</Label>
          <Input
            value={form.code}
            onChange={(e) => updateField("code", e.target.value)}
            placeholder="예: WELCOME10"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>할인 타입</Label>
            <Select
              value={form.type}
              onValueChange={(v) => updateField("type", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FIXED">정액 (원)</SelectItem>
                <SelectItem value="PERCENT">정률 (%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>할인값 *</Label>
            <Input
              type="number"
              value={form.discount_value || ""}
              onChange={(e) =>
                updateField("discount_value", Number(e.target.value))
              }
              placeholder={form.type === "FIXED" ? "3000" : "10"}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>최소 주문금액</Label>
            <Input
              type="number"
              value={form.min_order_amount || ""}
              onChange={(e) =>
                updateField("min_order_amount", Number(e.target.value))
              }
              placeholder="0"
            />
          </div>
          <div>
            <Label>최대 할인금액</Label>
            <Input
              type="number"
              value={form.max_discount || ""}
              onChange={(e) =>
                updateField("max_discount", Number(e.target.value))
              }
              placeholder="정률 시 사용"
            />
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>시작일 *</Label>
            <Input
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => updateField("starts_at", e.target.value)}
              required
            />
          </div>
          <div>
            <Label>만료일 *</Label>
            <Input
              type="datetime-local"
              value={form.expires_at}
              onChange={(e) => updateField("expires_at", e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <Label>최대 발급수</Label>
          <Input
            type="number"
            value={form.max_issues || ""}
            onChange={(e) =>
              updateField("max_issues", Number(e.target.value))
            }
            placeholder="0 = 무제한"
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "생성 중..." : "쿠폰 생성"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/coupons")}
          >
            취소
          </Button>
        </div>
      </form>
    </div>
  )
}

export default NewCouponPage

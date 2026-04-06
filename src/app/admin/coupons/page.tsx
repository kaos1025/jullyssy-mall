"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Search, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import dayjs from "dayjs"
import type { Coupon } from "@/types"

// ── 쿠폰 생성/수정 폼 초기값 ──
const EMPTY_FORM = {
  name: "",
  code: "",
  type: "FIXED" as "FIXED" | "PERCENT",
  value: 0,
  min_order_price: 0,
  max_discount: 0,
  starts_at: "",
  expires_at: "",
  total_quantity: 0,
  is_active: true,
}

// ── 회원 검색 결과 타입 ──
interface MemberRow {
  id: string
  name: string | null
  email: string
}

const AdminCouponsPage = () => {
  const { toast } = useToast()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)

  // 생성/수정 Dialog
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formLoading, setFormLoading] = useState(false)

  // 수동 발급 Dialog
  const [issueOpen, setIssueOpen] = useState(false)
  const [issueCouponId, setIssueCouponId] = useState<string | null>(null)
  const [issueSearch, setIssueSearch] = useState("")
  const [issueMembers, setIssueMembers] = useState<MemberRow[]>([])
  const [issueLoading, setIssueLoading] = useState(false)

  // ── 목록 조회 ──
  const fetchCoupons = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/admin/coupons")
    const data = await res.json()
    if (!data.error) setCoupons(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCoupons()
  }, [fetchCoupons])

  // ── 폼 헬퍼 ──
  const updateField = (field: string, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (coupon: Coupon) => {
    setEditingId(coupon.id)
    setForm({
      name: coupon.name,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      min_order_price: coupon.min_order_price,
      max_discount: coupon.max_discount || 0,
      starts_at: coupon.starts_at
        ? dayjs(coupon.starts_at).format("YYYY-MM-DDTHH:mm")
        : "",
      expires_at: coupon.expires_at
        ? dayjs(coupon.expires_at).format("YYYY-MM-DDTHH:mm")
        : "",
      total_quantity: coupon.total_quantity || 0,
      is_active: coupon.is_active,
    })
    setFormOpen(true)
  }

  // ── 생성 / 수정 저장 ──
  const handleSubmit = async () => {
    if (!form.name || !form.code || !form.value) {
      toast({ variant: "destructive", title: "필수 항목을 입력해주세요" })
      return
    }

    setFormLoading(true)

    if (editingId) {
      // 수정
      const res = await fetch(`/api/admin/coupons/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          min_order_price: form.min_order_price || 0,
          max_discount: form.max_discount || null,
          expires_at: form.expires_at
            ? new Date(form.expires_at).toISOString()
            : null,
          total_quantity: form.total_quantity || null,
          is_active: form.is_active,
        }),
      })
      const data = await res.json()
      if (data.error) {
        toast({ variant: "destructive", title: "수정 실패", description: data.error })
      } else {
        toast({ title: "쿠폰이 수정되었습니다" })
        setFormOpen(false)
        fetchCoupons()
      }
    } else {
      // 생성
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          code: form.code.toUpperCase(),
          type: form.type,
          value: form.value,
          min_order_price: form.min_order_price || 0,
          max_discount: form.max_discount || null,
          starts_at: form.starts_at
            ? new Date(form.starts_at).toISOString()
            : undefined,
          expires_at: form.expires_at
            ? new Date(form.expires_at).toISOString()
            : null,
          total_quantity: form.total_quantity || null,
        }),
      })
      const data = await res.json()
      if (data.error) {
        toast({ variant: "destructive", title: "생성 실패", description: data.error })
      } else {
        toast({ title: "쿠폰이 생성되었습니다" })
        setFormOpen(false)
        fetchCoupons()
      }
    }

    setFormLoading(false)
  }

  // ── 활성/비활성 토글 ──
  const handleToggleActive = async (coupon: Coupon) => {
    await fetch(`/api/admin/coupons/${coupon.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !coupon.is_active }),
    })
    fetchCoupons()
    toast({
      title: coupon.is_active ? "쿠폰이 비활성화되었습니다" : "쿠폰이 활성화되었습니다",
    })
  }

  // ── 수동 발급: 회원 검색 ──
  const handleSearchMembers = async () => {
    if (!issueSearch.trim()) return
    setIssueLoading(true)
    const res = await fetch(
      `/api/admin/members?search=${encodeURIComponent(issueSearch)}`
    )
    const data = await res.json()
    if (!data.error) setIssueMembers(data)
    setIssueLoading(false)
  }

  // ── 수동 발급: 발급 실행 ──
  const handleIssue = async (userId: string) => {
    if (!issueCouponId) return
    const res = await fetch(`/api/admin/coupons/${issueCouponId}/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    })
    const data = await res.json()
    if (data.error) {
      toast({ variant: "destructive", title: "발급 실패", description: data.error })
    } else {
      toast({ title: `쿠폰 발급 완료 (${data.issued}건)` })
      fetchCoupons()
    }
  }

  const openIssue = (couponId: string) => {
    setIssueCouponId(couponId)
    setIssueSearch("")
    setIssueMembers([])
    setIssueOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">쿠폰 관리</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          쿠폰 생성
        </Button>
      </div>

      {/* 테이블 */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left">코드</th>
              <th className="p-3 text-left">쿠폰명</th>
              <th className="p-3 text-center">타입</th>
              <th className="p-3 text-right">할인</th>
              <th className="p-3 text-right hidden md:table-cell">최소주문</th>
              <th className="p-3 text-center hidden md:table-cell">발급</th>
              <th className="p-3 text-left hidden md:table-cell">유효기간</th>
              <th className="p-3 text-center">상태</th>
              <th className="p-3 text-center">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="text-center py-10 text-muted-foreground">
                  로딩 중...
                </td>
              </tr>
            ) : coupons.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-10 text-muted-foreground">
                  쿠폰이 없습니다.
                </td>
              </tr>
            ) : (
              coupons.map((coupon) => {
                const isExpired = coupon.expires_at
                  ? dayjs(coupon.expires_at).isBefore(dayjs())
                  : false

                return (
                  <tr key={coupon.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">{coupon.code}</td>
                    <td className="p-3 font-medium">{coupon.name}</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline">
                        {coupon.type === "FIXED" ? "정액" : "정률"}
                      </Badge>
                    </td>
                    <td className="p-3 text-right font-medium">
                      {coupon.type === "FIXED"
                        ? `${coupon.value.toLocaleString()}원`
                        : `${coupon.value}%`}
                    </td>
                    <td className="p-3 text-right text-muted-foreground hidden md:table-cell">
                      {coupon.min_order_price > 0
                        ? `${coupon.min_order_price.toLocaleString()}원`
                        : "-"}
                    </td>
                    <td className="p-3 text-center hidden md:table-cell">
                      {coupon.issued_count}
                      {coupon.total_quantity != null
                        ? `/${coupon.total_quantity}`
                        : ""}
                    </td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell text-xs">
                      {dayjs(coupon.starts_at).format("MM/DD")} ~{" "}
                      {coupon.expires_at
                        ? dayjs(coupon.expires_at).format("MM/DD")
                        : "무기한"}
                    </td>
                    <td className="p-3 text-center">
                      <Badge
                        variant={
                          isExpired
                            ? "destructive"
                            : coupon.is_active
                              ? "default"
                              : "secondary"
                        }
                      >
                        {isExpired
                          ? "만료"
                          : coupon.is_active
                            ? "활성"
                            : "비활성"}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => openEdit(coupon)}
                        >
                          수정
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => openIssue(coupon.id)}
                        >
                          <Send className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => handleToggleActive(coupon)}
                        >
                          {coupon.is_active ? "비활성" : "활성"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── 쿠폰 생성/수정 Dialog ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "쿠폰 수정" : "쿠폰 생성"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>쿠폰 코드 *</Label>
              <Input
                value={form.code}
                onChange={(e) =>
                  updateField("code", e.target.value.toUpperCase())
                }
                placeholder="예: WELCOME10"
                disabled={!!editingId}
              />
            </div>

            <div>
              <Label>쿠폰명 *</Label>
              <Input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="예: 신규회원 10% 할인"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>할인 타입</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => updateField("type", v)}
                  disabled={!!editingId}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">정액할인 (원)</SelectItem>
                    <SelectItem value="PERCENT">정률할인 (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>
                  할인값 *{" "}
                  <span className="text-muted-foreground text-xs">
                    {form.type === "FIXED" ? "(원)" : "(%)"}
                  </span>
                </Label>
                <Input
                  type="number"
                  value={form.value || ""}
                  onChange={(e) =>
                    updateField("value", Number(e.target.value))
                  }
                  placeholder={form.type === "FIXED" ? "3000" : "10"}
                  disabled={!!editingId}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>최소 주문금액</Label>
                <Input
                  type="number"
                  value={form.min_order_price || ""}
                  onChange={(e) =>
                    updateField("min_order_price", Number(e.target.value))
                  }
                  placeholder="0"
                />
              </div>
              {form.type === "PERCENT" && (
                <div>
                  <Label>최대 할인금액</Label>
                  <Input
                    type="number"
                    value={form.max_discount || ""}
                    onChange={(e) =>
                      updateField("max_discount", Number(e.target.value))
                    }
                    placeholder="상한 없음"
                  />
                </div>
              )}
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>시작일 {!editingId && "*"}</Label>
                <Input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => updateField("starts_at", e.target.value)}
                />
              </div>
              <div>
                <Label>만료일</Label>
                <Input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) => updateField("expires_at", e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  미설정 시 무기한
                </p>
              </div>
            </div>

            <div>
              <Label>발급 수량</Label>
              <Input
                type="number"
                value={form.total_quantity || ""}
                onChange={(e) =>
                  updateField("total_quantity", Number(e.target.value))
                }
                placeholder="비워두면 무제한"
              />
            </div>

            {editingId && (
              <div className="flex items-center gap-3">
                <Label>활성 상태</Label>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => updateField("is_active", v)}
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleSubmit}
                disabled={formLoading}
                className="flex-1"
              >
                {formLoading
                  ? "저장 중..."
                  : editingId
                    ? "수정"
                    : "생성"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={formLoading}
              >
                취소
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 수동 발급 Dialog ── */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>쿠폰 수동 발급</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="이메일 또는 이름으로 검색"
                  value={issueSearch}
                  onChange={(e) => setIssueSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchMembers()}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                onClick={handleSearchMembers}
                disabled={issueLoading}
              >
                검색
              </Button>
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {issueLoading ? (
                <p className="text-center py-4 text-muted-foreground text-sm">
                  검색 중...
                </p>
              ) : issueMembers.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground text-sm">
                  {issueSearch
                    ? "검색 결과가 없습니다"
                    : "이메일 또는 이름을 입력해주세요"}
                </p>
              ) : (
                issueMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {member.name || "(이름 없음)"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.email}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleIssue(member.id)}
                    >
                      발급
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminCouponsPage

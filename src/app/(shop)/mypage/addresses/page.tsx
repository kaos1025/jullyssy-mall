"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { formatPhoneNumber } from "@/lib/utils"
import type { Address } from "@/types"

const MAX_ADDRESSES = 5

const emptyForm = {
  label: "",
  recipient: "",
  phone: "",
  zipcode: "",
  address1: "",
  address2: "",
  is_default: false,
}

const AddressesPage = () => {
  const { toast } = useToast()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchAddresses = useCallback(async () => {
    const res = await fetch("/api/addresses")
    if (res.ok) {
      setAddresses(await res.json())
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAddresses()
  }, [fetchAddresses])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (addr: Address) => {
    setEditingId(addr.id)
    setForm({
      label: addr.label,
      recipient: addr.recipient,
      phone: addr.phone,
      zipcode: addr.zipcode,
      address1: addr.address1,
      address2: addr.address2 || "",
      is_default: addr.is_default,
    })
    setDialogOpen(true)
  }

  const openPostcodeSearch = () => {
    if (typeof window === "undefined") return
    const daum = (window as unknown as Record<string, unknown>).daum as {
      Postcode: new (config: {
        oncomplete: (data: { zonecode: string; roadAddress: string }) => void
      }) => { open: () => void }
    } | undefined

    if (!daum?.Postcode) {
      const script = document.createElement("script")
      script.src =
        "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
      script.onload = () => openPostcodeSearch()
      document.head.appendChild(script)
      return
    }

    new daum.Postcode({
      oncomplete: (data: { zonecode: string; roadAddress: string }) => {
        setForm((prev) => ({
          ...prev,
          zipcode: data.zonecode,
          address1: data.roadAddress,
        }))
      },
    }).open()
  }

  const handleSave = async () => {
    if (!form.recipient || !form.phone || !form.zipcode || !form.address1) {
      toast({
        variant: "destructive",
        title: "필수 항목을 모두 입력해주세요",
      })
      return
    }

    setSaving(true)
    const url = editingId ? `/api/addresses/${editingId}` : "/api/addresses"
    const method = editingId ? "PUT" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    if (res.ok) {
      toast({ title: editingId ? "배송지가 수정되었습니다" : "배송지가 추가되었습니다" })
      setDialogOpen(false)
      fetchAddresses()
    } else {
      const err = await res.json()
      toast({ variant: "destructive", title: err.error })
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("이 배송지를 삭제하시겠습니까?")) return

    const res = await fetch(`/api/addresses/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast({ title: "배송지가 삭제되었습니다" })
      fetchAddresses()
    } else {
      const err = await res.json()
      toast({ variant: "destructive", title: err.error })
    }
  }

  const handleSetDefault = async (id: string) => {
    const res = await fetch(`/api/addresses/${id}`, { method: "PATCH" })
    if (res.ok) {
      toast({ title: "기본 배송지가 변경되었습니다" })
      fetchAddresses()
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20 text-muted-foreground">로딩 중...</div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">배송지 관리</h2>
        <Button
          size="sm"
          onClick={openCreate}
          disabled={addresses.length >= MAX_ADDRESSES}
        >
          <Plus className="h-4 w-4 mr-1" />
          새 배송지 추가
        </Button>
      </div>

      {addresses.length >= MAX_ADDRESSES && (
        <p className="text-sm text-muted-foreground mb-4">
          배송지는 최대 {MAX_ADDRESSES}개까지 등록할 수 있습니다.
        </p>
      )}

      {addresses.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          등록된 배송지가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <div key={addr.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {addr.is_default && (
                      <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                        기본배송지
                      </span>
                    )}
                    <span className="font-medium text-sm">{addr.label}</span>
                  </div>
                  <p className="text-sm">
                    {addr.recipient} / {addr.phone}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    [{addr.zipcode}] {addr.address1} {addr.address2 || ""}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(addr)}
                  >
                    수정
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(addr.id)}
                  >
                    삭제
                  </Button>
                </div>
              </div>
              {!addr.is_default && (
                <button
                  onClick={() => handleSetDefault(addr.id)}
                  className="text-xs text-muted-foreground hover:text-primary mt-2 underline"
                >
                  기본 배송지로 설정
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 추가/수정 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "배송지 수정" : "새 배송지 추가"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">배송지명</Label>
              <Input
                placeholder="예: 집, 회사"
                value={form.label}
                onChange={(e) =>
                  setForm((p) => ({ ...p, label: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">수령인</Label>
                <Input
                  placeholder="이름"
                  value={form.recipient}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, recipient: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">연락처</Label>
                <Input
                  type="tel"
                  placeholder="010-0000-0000"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      phone: formatPhoneNumber(e.target.value),
                    }))
                  }
                  maxLength={13}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="우편번호"
                value={form.zipcode}
                readOnly
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={openPostcodeSearch}
              >
                주소검색
              </Button>
            </div>
            <Input placeholder="기본주소" value={form.address1} readOnly />
            <Input
              placeholder="상세주소 입력"
              value={form.address2}
              onChange={(e) =>
                setForm((p) => ({ ...p, address2: e.target.value }))
              }
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="isDefault"
                checked={form.is_default}
                onCheckedChange={(checked) =>
                  setForm((p) => ({ ...p, is_default: !!checked }))
                }
              />
              <Label htmlFor="isDefault" className="text-sm">
                기본 배송지로 설정
              </Label>
            </div>
            <Button
              className="w-full"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "저장 중..." : editingId ? "수정하기" : "추가하기"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AddressesPage

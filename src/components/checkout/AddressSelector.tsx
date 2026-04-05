"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatPhoneNumber } from "@/lib/utils"
import type { Address } from "@/types"

interface AddressSelectorProps {
  onSelect: (address: {
    recipient: string
    phone: string
    zipcode: string
    address1: string
    address2: string
    memo: string
  }) => void
}

const MEMO_OPTIONS = [
  "문 앞에 놓아주세요",
  "경비실에 맡겨주세요",
  "배송 전 연락 부탁드립니다",
  "부재 시 문 앞에 놓아주세요",
]

const AddressSelector = ({ onSelect }: AddressSelectorProps) => {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [memo, setMemo] = useState("")
  const [memoOption, setMemoOption] = useState("")
  const [isCustomMemo, setIsCustomMemo] = useState(false)
  const [saveAddress, setSaveAddress] = useState(false)
  const [addressLabel, setAddressLabel] = useState("")
  const [newAddress, setNewAddress] = useState({
    recipient: "",
    phone: "",
    zipcode: "",
    address1: "",
    address2: "",
  })

  useEffect(() => {
    const fetchAddresses = async () => {
      const res = await fetch("/api/addresses")
      if (!res.ok) return

      const data: Address[] = await res.json()
      if (data.length > 0) {
        setAddresses(data)
        const defaultAddr = data.find((a) => a.is_default) || data[0]
        setSelectedId(defaultAddr.id)
        onSelect({
          recipient: defaultAddr.recipient,
          phone: defaultAddr.phone,
          zipcode: defaultAddr.zipcode,
          address1: defaultAddr.address1,
          address2: defaultAddr.address2 || "",
          memo: "",
        })
      } else {
        setIsNew(true)
      }
    }
    fetchAddresses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSelectChange = (value: string) => {
    if (value === "new") {
      setSelectedId(null)
      setIsNew(true)
      setNewAddress({ recipient: "", phone: "", zipcode: "", address1: "", address2: "" })
      onSelect({ recipient: "", phone: "", zipcode: "", address1: "", address2: "", memo })
      return
    }

    const addr = addresses.find((a) => a.id === value)
    if (!addr) return
    setSelectedId(value)
    setIsNew(false)
    onSelect({
      recipient: addr.recipient,
      phone: addr.phone,
      zipcode: addr.zipcode,
      address1: addr.address1,
      address2: addr.address2 || "",
      memo,
    })
  }

  const handleNewAddressChange = (field: string, value: string) => {
    const updated = { ...newAddress, [field]: value }
    setNewAddress(updated)
    onSelect({ ...updated, memo })
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
        const updated = {
          ...newAddress,
          zipcode: data.zonecode,
          address1: data.roadAddress,
        }
        setNewAddress(updated)
        onSelect({ ...updated, memo })
      },
    }).open()
  }

  const updateMemo = (memoValue: string) => {
    setMemo(memoValue)
    const selected = addresses.find((a) => a.id === selectedId)
    if (!isNew && selected) {
      onSelect({
        recipient: selected.recipient,
        phone: selected.phone,
        zipcode: selected.zipcode,
        address1: selected.address1,
        address2: selected.address2 || "",
        memo: memoValue,
      })
    } else {
      onSelect({ ...newAddress, memo: memoValue })
    }
  }

  const handleSaveNewAddress = async () => {
    if (!saveAddress) return
    await fetch("/api/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: addressLabel || "배송지",
        ...newAddress,
        is_default: false,
      }),
    })
  }

  // checkout 페이지에서 결제 전에 호출할 수 있도록 expose
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__saveNewAddress =
      handleSaveNewAddress
    return () => {
      delete (window as unknown as Record<string, unknown>).__saveNewAddress
    }
  })

  const selected = addresses.find((a) => a.id === selectedId)

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">배송지</h3>

      {/* 저장된 배송지 Select */}
      {addresses.length > 0 && (
        <Select
          value={isNew ? "new" : selectedId || undefined}
          onValueChange={handleSelectChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="배송지를 선택해주세요" />
          </SelectTrigger>
          <SelectContent>
            {addresses.map((addr) => (
              <SelectItem key={addr.id} value={addr.id}>
                {addr.label}
                {addr.is_default ? " (기본)" : ""} — {addr.recipient},{" "}
                {addr.address1}
              </SelectItem>
            ))}
            <SelectItem value="new">새 배송지 직접 입력</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* 선택된 배송지 표시 */}
      {!isNew && selected && (
        <div className="p-4 rounded-lg border bg-muted/30">
          <p className="font-medium text-sm">{selected.recipient}</p>
          <p className="text-sm">{selected.phone}</p>
          <p className="text-sm text-muted-foreground">
            [{selected.zipcode}] {selected.address1} {selected.address2}
          </p>
        </div>
      )}

      {/* 새 배송지 입력 폼 */}
      {isNew && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">수령인</Label>
              <Input
                placeholder="이름"
                value={newAddress.recipient}
                onChange={(e) =>
                  handleNewAddressChange("recipient", e.target.value)
                }
              />
            </div>
            <div>
              <Label className="text-xs">연락처</Label>
              <Input
                type="tel"
                placeholder="010-0000-0000"
                value={newAddress.phone}
                onChange={(e) =>
                  handleNewAddressChange(
                    "phone",
                    formatPhoneNumber(e.target.value)
                  )
                }
                maxLength={13}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="우편번호"
              value={newAddress.zipcode}
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
          <Input
            placeholder="기본주소"
            value={newAddress.address1}
            readOnly
          />
          <Input
            placeholder="상세주소 입력"
            value={newAddress.address2}
            onChange={(e) =>
              handleNewAddressChange("address2", e.target.value)
            }
          />

          {/* 이 배송지 저장 */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2">
              <Checkbox
                id="saveAddr"
                checked={saveAddress}
                onCheckedChange={(checked) => setSaveAddress(!!checked)}
              />
              <Label htmlFor="saveAddr" className="text-sm">
                이 배송지를 저장
              </Label>
            </div>
            {saveAddress && (
              <Input
                placeholder="배송지명 (예: 집, 회사)"
                value={addressLabel}
                onChange={(e) => setAddressLabel(e.target.value)}
              />
            )}
          </div>
        </div>
      )}

      {/* 배송 메모 */}
      <div className="space-y-2">
        <Label className="text-xs">배송 메모</Label>
        <Select
          value={memoOption}
          onValueChange={(value) => {
            setMemoOption(value)
            if (value === "custom") {
              setIsCustomMemo(true)
              updateMemo("")
            } else {
              setIsCustomMemo(false)
              updateMemo(value)
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="배송 시 요청사항을 선택해주세요" />
          </SelectTrigger>
          <SelectContent>
            {MEMO_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
            <SelectItem value="custom">직접 입력</SelectItem>
          </SelectContent>
        </Select>
        {isCustomMemo && (
          <Input
            placeholder="배송 시 요청사항을 입력해주세요"
            value={memo}
            onChange={(e) => updateMemo(e.target.value)}
          />
        )}
      </div>
    </div>
  )
}

export default AddressSelector

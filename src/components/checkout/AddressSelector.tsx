"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
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

const AddressSelector = ({ onSelect }: AddressSelectorProps) => {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [memo, setMemo] = useState("")
  const [newAddress, setNewAddress] = useState({
    recipient: "",
    phone: "",
    zipcode: "",
    address1: "",
    address2: "",
  })

  useEffect(() => {
    const fetchAddresses = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("addresses")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false })

      if (data && data.length > 0) {
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

  const handleSelectAddress = (addr: Address) => {
    setSelectedId(addr.id)
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
    // 다음 우편번호 API
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

  const selected = addresses.find((a) => a.id === selectedId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">배송지</h3>
        {addresses.length > 0 && (
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  주소록
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>배송지 선택</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {addresses.map((addr) => (
                    <button
                      key={addr.id}
                      onClick={() => handleSelectAddress(addr)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedId === addr.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/50"
                      }`}
                    >
                      <p className="font-medium text-sm">
                        {addr.label}
                        {addr.is_default && (
                          <span className="ml-2 text-xs text-primary">
                            기본
                          </span>
                        )}
                      </p>
                      <p className="text-sm">
                        {addr.recipient} / {addr.phone}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        [{addr.zipcode}] {addr.address1} {addr.address2}
                      </p>
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsNew(true)
                setSelectedId(null)
              }}
            >
              새 주소
            </Button>
          </div>
        )}
      </div>

      {!isNew && selected ? (
        <div className="p-4 rounded-lg border bg-muted/30">
          <p className="font-medium text-sm">{selected.recipient}</p>
          <p className="text-sm">{selected.phone}</p>
          <p className="text-sm text-muted-foreground">
            [{selected.zipcode}] {selected.address1} {selected.address2}
          </p>
        </div>
      ) : (
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
                placeholder="010-0000-0000"
                value={newAddress.phone}
                onChange={(e) =>
                  handleNewAddressChange("phone", e.target.value)
                }
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
        </div>
      )}

      {/* 배송 메모 */}
      <div>
        <Label className="text-xs">배송 메모</Label>
        <Input
          placeholder="배송 시 요청사항 (선택)"
          value={memo}
          onChange={(e) => {
            setMemo(e.target.value)
            if (!isNew && selected) {
              onSelect({
                recipient: selected.recipient,
                phone: selected.phone,
                zipcode: selected.zipcode,
                address1: selected.address1,
                address2: selected.address2 || "",
                memo: e.target.value,
              })
            } else {
              onSelect({ ...newAddress, memo: e.target.value })
            }
          }}
        />
      </div>
    </div>
  )
}

export default AddressSelector

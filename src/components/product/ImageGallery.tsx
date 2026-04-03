"use client"

import { useState } from "react"
import Image from "next/image"
import { Heart, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProductImage } from "@/types"

interface ImageGalleryProps {
  images: ProductImage[]
}

const ImageGallery = ({ images }: ImageGalleryProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [touchStart, setTouchStart] = useState(0)

  const currentImage = images[selectedIndex]

  const handleSwipe = (direction: "left" | "right") => {
    if (direction === "left" && selectedIndex < images.length - 1) {
      setSelectedIndex(selectedIndex + 1)
    } else if (direction === "right" && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1)
    }
  }

  return (
    <div className="w-full md:max-w-[600px] overflow-hidden space-y-3">
      {/* 메인 이미지 — aspect 3:4, PC max-h 800px → 너비 600px */}
      <div
        className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted"
        onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const diff = touchStart - e.changedTouches[0].clientX
          if (Math.abs(diff) > 50) {
            handleSwipe(diff > 0 ? "left" : "right")
          }
        }}
      >
        {currentImage ? (
          <Image
            src={currentImage.url}
            alt={`상품 이미지 ${selectedIndex + 1}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            이미지 없음
          </div>
        )}

        {/* 좌우 화살표 */}
        {images.length > 1 && selectedIndex > 0 && (
          <button
            onClick={() => setSelectedIndex(selectedIndex - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2 shadow-sm hover:bg-white transition-colors"
            aria-label="이전 이미지"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
        )}
        {images.length > 1 && selectedIndex < images.length - 1 && (
          <button
            onClick={() => setSelectedIndex(selectedIndex + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2 shadow-sm hover:bg-white transition-colors"
            aria-label="다음 이미지"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
          </button>
        )}

        {/* 찜하기 플로팅 아이콘 */}
        {/* TODO: 찜 기능 구현 후 onClick 연결 */}
        <button
          className="absolute top-3 right-3 bg-white/80 rounded-full p-2 shadow-sm hover:bg-white transition-colors"
          aria-label="찜하기"
        >
          <Heart className="h-5 w-5" strokeWidth={1.5} />
        </button>

        {/* 인디케이터 */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setSelectedIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === selectedIndex
                    ? "w-4 bg-white"
                    : "w-1.5 bg-white/50"
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* 썸네일 리스트 — 메인 이미지와 동일 너비, 1행 가로 스크롤 */}
      {images.length > 1 && (
        <div
          className="w-full flex flex-nowrap gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setSelectedIndex(i)}
              className={cn(
                "relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md cursor-pointer transition-all",
                i === selectedIndex
                  ? "ring-2 ring-primary ring-offset-1"
                  : "border border-transparent hover:opacity-80"
              )}
            >
              <Image
                src={img.url}
                alt={`썸네일 ${i + 1}`}
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ImageGallery

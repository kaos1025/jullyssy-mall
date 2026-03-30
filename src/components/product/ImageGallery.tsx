"use client"

import { useState } from "react"
import Image from "next/image"
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
    <div className="space-y-3">
      {/* 메인 이미지 */}
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

      {/* 썸네일 리스트 */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setSelectedIndex(i)}
              className={cn(
                "relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border-2 transition-colors",
                i === selectedIndex
                  ? "border-primary"
                  : "border-transparent hover:border-muted-foreground/30"
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

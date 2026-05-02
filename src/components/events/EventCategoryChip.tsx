import Link from "next/link"
import { type EventCategory } from "@/lib/events-utils"

interface Props {
  // id는 라우팅용 — asLink={false}(미리보기 등)인 경우 생략 가능
  category: Pick<EventCategory, "name" | "emoji" | "color"> & { id?: string }
  asLink?: boolean
  onClick?: () => void
}

const EventCategoryChip = ({ category, asLink = true, onClick }: Props) => {
  const { id, name, emoji, color } = category

  const content = (
    <span
      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-white whitespace-nowrap shrink-0"
      style={{ backgroundColor: color }}
    >
      {emoji ? <span>{emoji}</span> : null}
      <span>{name}</span>
    </span>
  )

  if (!asLink || !id) return content

  return (
    <Link href={`/events/${id}`} onClick={onClick}>
      {content}
    </Link>
  )
}

export default EventCategoryChip

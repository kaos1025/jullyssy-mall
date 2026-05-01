import Link from "next/link"
import { isExternalUrl, type EventCategory } from "@/lib/events-utils"

interface Props {
  category: Pick<EventCategory, "name" | "emoji" | "color" | "link_url">
  asLink?: boolean
}

const EventCategoryChip = ({ category, asLink = true }: Props) => {
  const { name, emoji, color, link_url } = category

  const content = (
    <span
      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-white whitespace-nowrap shrink-0"
      style={{ backgroundColor: color }}
    >
      {emoji ? <span>{emoji}</span> : null}
      <span>{name}</span>
    </span>
  )

  if (!asLink) return content

  const external = isExternalUrl(link_url)
  return (
    <Link
      href={link_url}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
    >
      {content}
    </Link>
  )
}

export default EventCategoryChip

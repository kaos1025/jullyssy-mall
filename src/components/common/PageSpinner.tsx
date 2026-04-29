import { Loader2 } from "lucide-react"

const PageSpinner = () => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

export default PageSpinner

import Link from "next/link"

const AuthLayout = ({
  children,
}: {
  children: React.ReactNode
}) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4">
      <div className="mb-8">
        <Link href="/" className="text-2xl font-bold text-primary">
          쥴리씨
        </Link>
      </div>
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  )
}

export default AuthLayout

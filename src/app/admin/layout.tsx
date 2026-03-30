import AdminSidebar from "@/components/layout/AdminSidebar"

const AdminLayout = ({
  children,
}: {
  children: React.ReactNode
}) => {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b flex items-center px-6 bg-background">
          <h1 className="text-sm font-medium text-muted-foreground">
            쥴리씨 관리자
          </h1>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}

export default AdminLayout

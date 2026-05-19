import { Header } from '@/components/layout/Header'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { Sidebar } from '@/components/layout/Sidebar'

export default function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="flex-1 px-4 py-5 pb-24 md:p-6">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  )
}

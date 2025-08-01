import Navbar from './Navbar'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 pt-24 pb-8">
        {children}
      </main>
    </div>
  )
}

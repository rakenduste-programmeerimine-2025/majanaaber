import { ThemeSwitcher } from "@/components/theme-switcher"
import { AuthButton } from "@/components/auth-button"
import Link from "next/link"

interface ManagerLayoutProps {
  children: React.ReactNode
}

export default function ManagerLayout({ children }: ManagerLayoutProps) {
  const managerLinks = [{ label: "Hub", href: `/manager-hub` }]

  return (
    <main className="min-h-screen flex flex-col">
      {/* Top header */}
      <nav className="w-full border-b border-b-foreground/10">
        <div className="max-w-7xl mx-auto flex justify-between items-center p-3 px-5">
          <div className="flex gap-5 items-center font-semibold">
            <span>Manager hub</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/manager-hub"
              className="text-sm hover:underline"
            >
              Home
            </Link>
            <Link
              href="/profile"
              className="text-sm hover:underline"
            >
              Profile
            </Link>
            <ThemeSwitcher />
            <AuthButton />
          </div>
        </div>
      </nav>
      <div className="flex-1">{children}</div>
    </main>
  )
}

import { NavBar } from "@/components/navbar"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { AuthButton } from "@/components/auth-button"
import Link from "next/link"

interface ManagerLayoutProps {
  children: React.ReactNode
}

export default function ManagerLayout({ children }: ManagerLayoutProps) {
  const managerLinks = [
    { label: "Home", href: `/manager-hub` },
    { label: "Bookmarks", href: "#", disabled: true },
  ]

  return (
    <main className="min-h-screen flex flex-col">
      {/* Top header */}
      <nav className="w-full border-b border-b-foreground/10">
        <div className="max-w-7xl mx-auto flex justify-between items-center p-3 px-5">
          <div className="flex gap-5 items-center font-semibold">
            <span>Building Management</span>
          </div>
          <div className="flex items-center gap-4">
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

      <NavBar links={managerLinks} />

      <div className="flex-1">{children}</div>
    </main>
  )
}

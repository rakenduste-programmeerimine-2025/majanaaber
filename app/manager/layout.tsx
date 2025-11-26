import { NavBar } from "@/components/navbar"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { AuthButton } from "@/components/auth-button"

interface ManagerLayoutProps {
  children: React.ReactNode
}

export default function ManagerLayout({ children, }: ManagerLayoutProps) {
  const managerLinks = [
    { label: "Home", href: `/protected` },
    { label: "Profile", href: "#", disabled: true },
    { label: "Bookmarks", href: "#", disabled: true },
  ]

  return (
    <main className="min-h-screen flex flex-col">
      {/* Top header */}
      <nav className="w-full border-b border-b-foreground/10">
        <div className="max-w-7xl mx-auto flex justify-between items-center p-3 px-5">
          <div className="flex gap-5 items-center font-semibold">
            <span>Manager Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
            <AuthButton />
          </div>
        </div>
      </nav>

      {/* Nav bar */}
      <NavBar links={managerLinks} />

      {/* Page content */}
      <div className="flex-1">{children}</div>
    </main>
  )
}

import { AuthButton } from "@/components/auth-button"
import { NavBar } from "@/components/navbar"
import { ThemeSwitcher } from "@/components/theme-switcher"

export default function ResidentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const residentLinks = [
    { label: "Home", href: "/protected" },
    { label: "Profile", href: "#", disabled: true },
    { label: "Bookmarks", href: "#", disabled: true },
  ]
  return (
    <main className="min-h-screen flex flex-col">
      <nav className="w-full border-b border-b-foreground/10">
        <div className="w-full max-w-7xl mx-auto flex justify-between items-center p-3 px-5">
          <div className="flex gap-5 items-center font-semibold">
            <span>Resident dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
            <AuthButton />
          </div>
        </div>
      </nav>

      <NavBar links={residentLinks} />
      <div className="flex-1">{children}</div>
    </main>
  )
}

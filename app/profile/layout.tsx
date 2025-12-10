import { AuthButton } from "@/components/auth-button"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { BackButton } from "@/components/back-button"
import { HomeLink } from "@/components/home-link"

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Top header */}
      <nav className="w-full border-b border-b-foreground/10 bg-card">
        <div className="max-w-7xl mx-auto flex justify-between items-center p-3 px-5">
          <div className="flex gap-5 items-center font-semibold">
            <BackButton />
            <span className="text-muted-foreground">|</span>
            <span>Profile</span>
            </div>
          <div className="flex items-center gap-4">
            <HomeLink className="text-sm hover:underline" />
            <ThemeSwitcher />
            <AuthButton />
          </div>
        </div>
      </nav>
      <div className="flex-1">{children}</div>
    </main>
  )
}

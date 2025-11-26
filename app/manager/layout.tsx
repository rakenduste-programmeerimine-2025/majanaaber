import { AuthButton } from "@/components/auth-button"
import { ThemeSwitcher } from "@/components/theme-switcher"
import Link from "next/link"

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen flex flex-col">
      <nav className="w-full border-b border-b-foreground/10">
        <div className="w-full max-w-7xl mx-auto flex justify-between items-center p-3 px-5">
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
      <div className="flex-1">{children}</div>
    </main>
  )
}

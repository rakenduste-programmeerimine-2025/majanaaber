import { ThemeSwitcher } from "@/components/theme-switcher"
import { AuthButton } from "@/components/auth-button"
import Link from "next/link"
import { BackButton } from "@/components/back-button"
import { useTranslations } from "next-intl"
interface ManagerLayoutProps {
  children: React.ReactNode
}

export default function ManagerLayout({ children }: ManagerLayoutProps) {
  const t = useTranslations()
  return (
    <main className="min-h-screen flex flex-col">
      {/* Top header */}
      <nav className="w-full border-b border-b-foreground/10 bg-card">
        <div className="max-w-7xl mx-auto flex justify-between items-center p-3 px-5">
          <div className="flex gap-5 items-center font-semibold">
            <BackButton />
            <span className="text-muted-foreground">|</span>
            <span>{t("layout.buildingManagement")}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/manager"
              className="text-sm hover:underline"
            >
              {t("layout.home")}
            </Link>
            <Link
              href="/profile"
              className="text-sm hover:underline"
            >
              {t("layout.profile")}
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

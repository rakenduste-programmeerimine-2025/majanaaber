import { LoginForm } from "@/components/login-form";
import Link from "next/link";
import { useTranslations } from "next-intl"

export default function Page() {
  const t = useTranslations()
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center p-6 md:p-10">
      {/* Minimal header */}
      <header className="w-full max-w-sm mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm px-3 py-1 border rounded hover:bg-muted"
        >
          ← {t("backMainPage.message")}
        </Link>
      </header>

      {/* Login form */}
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}

import { EnvVarWarning } from "@/components/env-var-warning"
import { AuthButton } from "@/components/auth-button"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { LandingHero } from "@/components/landing/landing-hero"
import { LandingFeatures } from "@/components/landing/landing-features"
import { LandingCTA } from "@/components/landing/landing-cta"
import { hasEnvVars } from "@/lib/utils"
import Link from "next/link"
import { Building2 } from "lucide-react"

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-7xl flex justify-between items-center p-3 px-5 text-sm">
            <Link
              href={"/"}
              className="flex items-center gap-2 font-semibold"
            >
              <Building2 className="w-5 h-5" />
              <span>MajaNaaber</span>
            </Link>
            <div className="flex items-center gap-4">
              {!hasEnvVars ? <EnvVarWarning /> : <AuthButton />}
              <ThemeSwitcher />
            </div>
          </div>
        </nav>

        <div className="flex-1 w-full flex flex-col gap-16 items-center py-12">
          <LandingHero />
          <LandingFeatures />
          <LandingCTA />
        </div>

        <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
          <p className="text-muted-foreground">
            &copy; {new Date().getFullYear()} MajaNaaber. All rights reserved.
          </p>
          <ThemeSwitcher />
        </footer>
      </div>
    </main>
  )
}

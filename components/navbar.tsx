"use client"

import Link from "next/link"

interface NavItem {
  label: string
  href: string
  disabled?: boolean
}

interface NavBarProps {
  links: NavItem[]
}

export function NavBar({ links }: NavBarProps) {
  return (
    <nav className="bg-card dark:bg-card border-b border-b-foreground/10">
      <div className="max-w-7xl mx-auto flex gap-5 p-3 px-5">
        {links.map(({ label, href, disabled }) => (
          <Link
            key={label}
            href={disabled ? "#" : href}
            className={`font-medium hover:text-primary ${
              disabled ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}

"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

export function HomeLink({ className }: { className?: string }) {
  const [homeUrl, setHomeUrl] = useState("/resident")

  useEffect(() => {
    const checkRole = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()

        if (profile?.role === "building_manager") {
          setHomeUrl("/manager")
        }
      }
    }

    checkRole()
  }, [])

  return (
    <Link href={homeUrl} className={className}>
      Home
    </Link>
  )
}

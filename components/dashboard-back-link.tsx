"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

export function DashboardBackLink() {
  const [dashboardLink, setDashboardLink] = useState("/protected")

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

        if (profile?.role === "building_owner") {
          setDashboardLink("/manager")
        }
      }
    }

    checkRole()
  }, [])

  return (
    <Link
      href={dashboardLink}
      className="hover:underline"
    >
      ← Back to Dashboard
    </Link>
  )
}

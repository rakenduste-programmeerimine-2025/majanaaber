"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export default function DebugProfilePage() {
  const [profileData, setProfileData] = useState<any>(null)
  const [userAuth, setUserAuth] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      
      // Get auth user
      const { data: { user } } = await supabase.auth.getUser()
      setUserAuth(user)
      
      if (user) {
        // Get profile data
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()
        
        setProfileData({ profile, error })
      }
      
      setLoading(false)
    }
    
    loadData()
  }, [])

  if (loading) return <div>Loading...</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Profile Information</h1>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Auth User:</h2>
        <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
          {JSON.stringify(userAuth, null, 2)}
        </pre>
      </div>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Profile Data:</h2>
        <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
          {JSON.stringify(profileData, null, 2)}
        </pre>
      </div>
    </div>
  )
}
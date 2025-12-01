"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AddBuildingForm } from "@/components/add-building-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Search } from "lucide-react"

interface Building {
  id: string
  full_address: string
  city: string
  apartment_count: number | null
  created_at: string
}

export default function ManagerHubPage() {
  const [buildings, setBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [buildingSearchQuery, setBuildingSearchQuery] = useState("")

  const loadData = async () => {
    try {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("User not authenticated")
      }

      // Load buildings managed by user
      const { data: buildingsData, error: buildingsError } = await supabase
        .from("buildings")
        .select("id, full_address, city, apartment_count, created_at")
        .eq("manager_id", user.id)
        .order("created_at", { ascending: false })

      if (buildingsError) {
        throw buildingsError
      }

      setBuildings(buildingsData || [])
    } catch (err: any) {
      setError(err.message || "Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    const supabase = createClient()

    // Subscribe to buildings changes
    const buildingsSubscription = supabase
      .channel("buildings_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "buildings",
        },
        () => {
          loadData()
        },
      )
      .subscribe()

    // Cleanup subscriptions on unmount
    return () => {
      buildingsSubscription.unsubscribe()
    }
  }, [])

  const handleAddSuccess = () => {
    setShowAddForm(false)
    loadData()
  }

  const handleDeleteBuilding = async (buildingId: string) => {
    if (!confirm("Are you sure you want to delete this building?")) {
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("buildings")
        .delete()
        .eq("id", buildingId)

      if (error) {
        throw error
      }

      loadData()
    } catch (err: any) {
      alert("Failed to delete building: " + err.message)
    }
  }

  // Filter data based on search queries
  const filteredBuildings = buildings.filter(building => {
    const query = buildingSearchQuery.toLowerCase()
    return (
      building.full_address.toLowerCase().includes(query) ||
      building.city.toLowerCase().includes(query)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Buildings</h1>
          <p className="text-gray-600">Manage your building properties</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <Badge variant="outline">{buildings.length} buildings</Badge>
        </div>

        {!showAddForm && (
          <div className="mb-6">
            <Button
              onClick={() => setShowAddForm(true)}
              className="w-full"
            >
              + Add New Building
            </Button>
          </div>
        )}

        {showAddForm && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Add New Building</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddForm(false)}
              >
                ✕
              </Button>
            </div>
            <AddBuildingForm onSuccess={handleAddSuccess} />
          </div>
        )}

        {buildings.length > 0 && !showAddForm && (
          <div className="relative w-full mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search buildings..."
              value={buildingSearchQuery}
              onChange={e => setBuildingSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        )}

        {buildings.length === 0 && !showAddForm ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-500">
                No buildings yet. Add your first building to get started!
              </p>
            </CardContent>
          </Card>
        ) : filteredBuildings.length === 0 && !showAddForm ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-500">
                No buildings match your search.
              </p>
            </CardContent>
          </Card>
        ) : !showAddForm ? (
          <div className="space-y-3">
            {filteredBuildings.map(building => (
              <Card
                key={building.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div>
                      <p className="font-semibold text-lg">
                        {building.full_address}
                      </p>
                      <p className="text-sm text-gray-600">{building.city}</p>
                    </div>

                    {building.apartment_count !== null && (
                      <div>
                        <p className="text-xs text-gray-600 uppercase tracking-wider">
                          Apartments
                        </p>
                        <p className="font-semibold">
                          {building.apartment_count}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        asChild
                      >
                        <Link href={`/manager?building=${building.id}`}>
                          Manage
                        </Link>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteBuilding(building.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

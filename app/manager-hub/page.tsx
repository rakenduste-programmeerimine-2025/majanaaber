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

interface Apartment {
  id: string
  building_id: string
  apartment_number: string
  resident_role: string
  building: {
    full_address: string
    city: string
  }
}

export default function ManagerHubPage() {
  const [buildings, setBuildings] = useState<Building[]>([])
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [buildingSearchQuery, setBuildingSearchQuery] = useState("")
  const [apartmentSearchQuery, setApartmentSearchQuery] = useState("")

  const loadData = async () => {
    try {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("User not authenticated")
      }

      const { data: buildingsData, error: buildingsError } = await supabase
        .from("buildings")
        .select("id, full_address, city, apartment_count, created_at")
        .eq("manager_id", user.id)
        .order("created_at", { ascending: false })

      if (buildingsError) {
        throw buildingsError
      }

      setBuildings(buildingsData || [])

      const { data: apartmentsData, error: apartmentsError } = await supabase
        .from("building_residents")
        .select(
          `
          id,
          building_id,
          apartment_number,
          resident_role,
          building:buildings(full_address, city)
        `,
        )
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false })

      if (apartmentsError) {
        throw apartmentsError
      }

      const mappedApartments = (apartmentsData || []).map(item => ({
        ...item,
        building: Array.isArray(item.building)
          ? item.building[0]
          : item.building,
      }))
      setApartments(mappedApartments as Apartment[])
    } catch (err: any) {
      setError(err.message || "Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    const supabase = createClient()

    const apartmentsSubscription = supabase
      .channel("building_residents_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "building_residents",
        },
        () => {
          loadData()
        },
      )
      .subscribe()

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

    return () => {
      apartmentsSubscription.unsubscribe()
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

  const filteredBuildings = buildings.filter(building => {
    const query = buildingSearchQuery.toLowerCase()
    return (
      building.full_address.toLowerCase().includes(query) ||
      building.city.toLowerCase().includes(query)
    )
  })

  const filteredApartments = apartments.filter(apartment => {
    const query = apartmentSearchQuery.toLowerCase()
    return (
      apartment.apartment_number.toLowerCase().includes(query) ||
      apartment.building.full_address.toLowerCase().includes(query) ||
      apartment.building.city.toLowerCase().includes(query)
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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-gray-600">Manage your apartments and buildings</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Apartments */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold">My Apartments</h2>
              <Badge variant="outline">{apartments.length}</Badge>
            </div>

            {apartments.length > 0 && (
              <div className="relative w-full mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search apartments..."
                  value={apartmentSearchQuery}
                  onChange={e => setApartmentSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}

            {apartments.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-gray-500">
                    You are not connected to any apartments yet.
                  </p>
                </CardContent>
              </Card>
            ) : filteredApartments.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-gray-500">
                    No apartments match your search.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredApartments.map(apartment => (
                  <Card
                    key={apartment.id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600">Building</p>
                          <p className="font-semibold text-lg">
                            {apartment.building.full_address}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-600 uppercase tracking-wider">
                              Apartment
                            </p>
                            <p className="font-semibold text-lg">
                              {apartment.apartment_number}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 uppercase tracking-wider">
                              Role
                            </p>
                            <Badge
                              variant={
                                apartment.resident_role === "apartment_owner"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {apartment.resident_role === "apartment_owner"
                                ? "Apt. Owner"
                                : "Resident"}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-xs text-gray-600 uppercase tracking-wider">
                              Location
                            </p>
                            <p className="text-gray-700">
                              {apartment.building.city}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            asChild
                          >
                            <Link
                              href={`/resident?building=${apartment.building_id}`}
                            >
                              Select
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Right Column - Buildings */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold">My Buildings</h2>
              <Badge variant="outline">{buildings.length}</Badge>
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
                          <p className="text-sm text-gray-600">
                            {building.city}
                          </p>
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
      </div>
    </div>
  )
}

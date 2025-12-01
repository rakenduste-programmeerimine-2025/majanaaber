"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Search } from "lucide-react"

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

export default function ResidentHubPage() {
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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

      // Load apartments where user is a resident
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

      // Map the data to match our Apartment interface
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

    // Subscribe to building_residents changes
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

    // Cleanup subscriptions on unmount
    return () => {
      apartmentsSubscription.unsubscribe()
    }
  }, [])

  // Filter data based on search queries
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
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Apartments</h1>
          <p className="text-gray-600">View and access your apartments</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <Badge variant="outline">{apartments.length} apartments</Badge>
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
    </div>
  )
}

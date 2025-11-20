"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AddBuildingForm } from "@/components/add-building-form"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

export default function ProtectedPage() {
  const [buildings, setBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const loadBuildings = async () => {
    try {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { data, error: buildingsError } = await supabase
        .from("buildings")
        .select("id, full_address, city, apartment_count, created_at")
        .eq("manager_id", user?.id)
        .order("created_at", { ascending: false })

      if (buildingsError) {
        throw buildingsError
      }

      setBuildings(data || [])
    } catch (err: any) {
      setError(err.message || "Failed to load buildings")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBuildings()
  }, [])

  const handleAddSuccess = () => {
    setShowAddForm(false)
    loadBuildings()
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

      loadBuildings()
    } catch (err: any) {
      alert("Failed to delete building: " + err.message)
    }
  }

  // Filter buildings based on search query
  const filteredBuildings = buildings.filter(building => {
    const query = searchQuery.toLowerCase()
    return (
      building.full_address.toLowerCase().includes(query) ||
      building.city.toLowerCase().includes(query)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">Loading buildings...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Building Management</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage apartment buildings and their information
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Add Building Button */}
      {!showAddForm && (
        <div className="mb-6">
          <Button
            onClick={() => setShowAddForm(true)}
            size="lg"
          >
            + Add New Building
          </Button>
        </div>
      )}

      {/* Add Building Form */}
      {showAddForm && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Add New Building</h2>
            <Button
              variant="outline"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </Button>
          </div>
          <AddBuildingForm onSuccess={handleAddSuccess} />
        </div>
      )}

      {/* Buildings List */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Your Buildings</h2>

        {buildings.length > 0 && (
          <div className="relative w-full max-w-md mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search buildings by address or city..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        )}

        {buildings.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-500">
                No buildings yet. Add your first building to get started!
              </p>
            </CardContent>
          </Card>
        ) : filteredBuildings.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-500">
                No buildings match your search. Try a different search term.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredBuildings.map(building => (
              <Card key={building.id}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {building.full_address}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        City:
                      </span>
                      <Badge variant="secondary">{building.city}</Badge>
                    </div>
                    {building.apartment_count !== null && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Apartments:
                        </span>
                        <Badge variant="secondary">
                          {building.apartment_count}
                        </Badge>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Added:
                      </span>
                      <span className="text-sm">
                        {new Date(building.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="pt-4 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        asChild
                      >
                        <Link href={`/manager?building=${building.id}`}>
                          Manage Building
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
        )}
      </div>
    </div>
  )
}

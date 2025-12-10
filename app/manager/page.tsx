"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { changeBuildingManager } from "@/app/actions/auth"
import { AddBuildingForm } from "@/components/add-building-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Search } from "lucide-react"
import { ErrorDisplay } from "@/components/ui/error-display"
import { useErrorHandler } from "@/hooks/use-error-handler"

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
  const { error, setError, clearError, handleError } = useErrorHandler()
  const [showAddForm, setShowAddForm] = useState(false)
  const [buildingSearchQuery, setBuildingSearchQuery] = useState("")
  const [apartmentSearchQuery, setApartmentSearchQuery] = useState("")
  const [changeManagerBuildingId, setChangeManagerBuildingId] = useState<
    string | null
  >(null)
  const [allUsers, setAllUsers] = useState<
    Array<{ id: string; first_name: string; last_name: string; email: string }>
  >([])
  const [searchUserQuery, setSearchUserQuery] = useState("")
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)
  const [showAllApartments, setShowAllApartments] = useState(false)
  const [showAllBuildings, setShowAllBuildings] = useState(false)

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
      handleError(err, "Failed to load data")
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
      handleError(err, "Failed to delete building")
    }
  }

  const loadUsersForManagerChange = async () => {
    try {
      setIsSearchingUsers(true)
      const supabase = createClient()

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("User not authenticated")
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .neq("id", user.id)
        .limit(100)

      if (error) throw error

      setAllUsers(data || [])
    } catch (err: any) {
      console.error("Error loading users:", err)
      alert("Failed to load users: " + err.message)
    } finally {
      setIsSearchingUsers(false)
    }
  }

  const handleChangeManager = async (
    buildingId: string,
    newManagerId: string,
  ) => {
    if (
      !confirm(
        "Are you sure you want to transfer this building to the selected manager?",
      )
    ) {
      return
    }

    try {
      const result = await changeBuildingManager(buildingId, newManagerId)

      if (!result.success) {
        throw new Error(result.error)
      }

      setChangeManagerBuildingId(null)
      setSearchUserQuery("")

      // Hard refresh to ensure middleware runs and new user is redirected to appropriate dashboard
      window.location.reload()
    } catch (err: any) {
      handleError(err, "Failed to change manager")
    }
  }

  const filteredUsers = allUsers.filter(user => {
    const query = searchUserQuery.toLowerCase()
    return (
      user.first_name?.toLowerCase().includes(query) ||
      user.last_name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    )
  })

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
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your apartments and buildings
          </p>
        </div>

        <ErrorDisplay
          error={error}
          onClear={clearError}
          className="mb-6"
        />

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
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                  <p className="text-center text-muted-foreground">
                    You are not connected to any apartments yet.
                  </p>
                </CardContent>
              </Card>
            ) : filteredApartments.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground\">
                    No apartments match your search.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {filteredApartments.length <= 4 ? (
                  <div className="space-y-3">
                    {filteredApartments.map(apartment => (
                      <Card
                        key={apartment.id}
                        className="hover:shadow-md transition-shadow"
                      >
                        <CardContent className="pt-6">
                          <div className="space-y-3">
                            <div>
                              <p className="text-sm text-muted-foreground">
                                Building
                              </p>
                              <p className="font-semibold text-lg">
                                {apartment.building.full_address}
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                                  Apartment
                                </p>
                                <p className="font-semibold text-lg">
                                  {apartment.apartment_number}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                                  Role
                                </p>
                                <Badge
                                  variant={
                                    apartment.resident_role ===
                                    "apartment_owner"
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
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                                  Location
                                </p>
                                <p className="text-foreground">
                                  {apartment.building.city}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                asChild
                              >
                                <Link
                                  href={`/residence?building=${apartment.building_id}`}
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
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(showAllApartments
                        ? filteredApartments
                        : filteredApartments.slice(0, 4)
                      ).map(apartment => (
                        <Card
                          key={apartment.id}
                          className="hover:shadow-md transition-shadow"
                        >
                          <CardContent className="pt-4 pb-4">
                            <div className="space-y-2">
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Building
                                </p>
                                <p className="font-semibold text-sm">
                                  {apartment.building.full_address}
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    Apt.
                                  </p>
                                  <p className="font-semibold">
                                    {apartment.apartment_number}
                                  </p>
                                </div>
                                <div>
                                  <Badge
                                    variant={
                                      apartment.resident_role ===
                                      "apartment_owner"
                                        ? "default"
                                        : "secondary"
                                    }
                                    className="text-xs"
                                  >
                                    {apartment.resident_role ===
                                    "apartment_owner"
                                      ? "Owner"
                                      : "Resident"}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  {apartment.building.city}
                                </span>
                                <Button
                                  size="sm"
                                  asChild
                                >
                                  <Link
                                    href={`/residence?building=${apartment.building_id}`}
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
                    {filteredApartments.length > 4 && (
                      <div className="flex justify-center mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setShowAllApartments(!showAllApartments)
                          }
                        >
                          {showAllApartments
                            ? "Show Less"
                            : `Show All (${filteredApartments.length})`}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* Right Column - Buildings */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-semibold">My Buildings</h2>
                {!showAddForm && (
                  <Button
                    onClick={() => setShowAddForm(true)}
                    size="sm"
                    className="h-9"
                  >
                    + Add New Building
                  </Button>
                )}
              </div>
              <Badge variant="outline">{buildings.length}</Badge>
            </div>

            {showAddForm && (
              <div className="mb-6 p-4 bg-primary/10 rounded-lg border border-primary/20\">
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
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                  <p className="text-center text-muted-foreground">
                    No buildings yet. Add your first building to get started!
                  </p>
                </CardContent>
              </Card>
            ) : filteredBuildings.length === 0 && !showAddForm ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    No buildings match your search.
                  </p>
                </CardContent>
              </Card>
            ) : !showAddForm ? (
              <>
                {filteredBuildings.length <= 4 ? (
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
                              <p className="text-sm text-muted-foreground">
                                {building.city}
                              </p>
                            </div>

                            {building.apartment_count !== null && (
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">
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
                                <Link
                                  href={`/management?building=${building.id}`}
                                >
                                  Manage
                                </Link>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setChangeManagerBuildingId(building.id)
                                  loadUsersForManagerChange()
                                }}
                              >
                                Change Manager
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  handleDeleteBuilding(building.id)
                                }
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(showAllBuildings
                        ? filteredBuildings
                        : filteredBuildings.slice(0, 4)
                      ).map(building => (
                        <Card
                          key={building.id}
                          className="hover:shadow-md transition-shadow"
                        >
                          <CardContent className="pt-4 pb-4">
                            <div className="space-y-2">
                              <div>
                                <p className="font-semibold text-sm">
                                  {building.full_address}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {building.city}
                                </p>
                              </div>
                              {building.apartment_count !== null && (
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    Apartments
                                  </p>
                                  <p className="font-semibold text-sm">
                                    {building.apartment_count}
                                  </p>
                                </div>
                              )}
                              <div className="flex gap-1 pt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 text-xs"
                                  asChild
                                >
                                  <Link
                                    href={`/management?building=${building.id}`}
                                  >
                                    Manage
                                  </Link>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 text-xs"
                                  onClick={() =>
                                    setChangeManagerBuildingId(building.id)
                                  }
                                >
                                  Change
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {filteredBuildings.length > 4 && (
                      <div className="flex justify-center mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAllBuildings(!showAllBuildings)}
                        >
                          {showAllBuildings
                            ? "Show Less"
                            : `Show All (${filteredBuildings.length})`}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* Change Manager Overlay */}
        {changeManagerBuildingId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">
                      Select New Manager
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setChangeManagerBuildingId(null)
                        setSearchUserQuery("")
                      }}
                    >
                      ✕
                    </Button>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search by name or email..."
                      value={searchUserQuery}
                      onChange={e => setSearchUserQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {isSearchingUsers ? (
                      <p className="text-center text-muted-foreground\">
                        Loading users...
                      </p>
                    ) : filteredUsers.length === 0 ? (
                      <p className="text-center text-muted-foreground">
                        No users found
                      </p>
                    ) : (
                      filteredUsers.map(user => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/30 cursor-pointer\"
                          onClick={() =>
                            handleChangeManager(
                              changeManagerBuildingId,
                              user.id,
                            )
                          }
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {user.first_name} {user.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {user.email}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            className="ml-2 flex-shrink-0"
                            onClick={e => {
                              e.stopPropagation()
                              handleChangeManager(
                                changeManagerBuildingId,
                                user.id,
                              )
                            }}
                          >
                            Select
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

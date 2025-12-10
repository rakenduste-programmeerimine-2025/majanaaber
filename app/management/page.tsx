"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { NoticeBoard } from "@/components/notices"
import { ChatBox } from "@/components/chat-box"
import { useBuildingMessages } from "@/hooks/use-building-messages"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BuildingCalendar } from "@/components/building-calendar"
import Link from "next/link"
import { MessageSquare } from "lucide-react"
import { useTranslations } from "next-intl"

interface Building {
  id: string
  full_address: string
  manager_id: string
}

interface Profile {
  id: string
  first_name: string
  last_name: string
  email: string
}

interface Resident {
  id: string
  profile_id: string
  apartment_number: string | null
  resident_role: string
  is_approved: boolean
  profile: Profile
}

interface ResidentForm {
  profileId: string | null
  apartmentNumber: string
  residentRole: "resident" | "apartment_owner"
}

interface EditingResident {
  id: string
  apartmentNumber: string
  residentRole: "resident" | "apartment_owner"
}

interface Notice {
  id: string
  title: string
  event_date: string | null
}

export default function ManagerDashboard() {
  const t = useTranslations()
  const [building, setBuilding] = useState<Building | null>(null)
  const [loading, setLoading] = useState(true)
  const [showResidentsOverlay, setShowResidentsOverlay] = useState(false)
  const [residents, setResidents] = useState<Resident[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [residentForm, setResidentForm] = useState<ResidentForm>({
    profileId: null,
    apartmentNumber: "",
    residentRole: "resident",
  })
  const [editingResident, setEditingResident] =
    useState<EditingResident | null>(null)

  const [notices, setNotices] = useState<Notice[]>([])
  const searchParams = useSearchParams()
  const buildingId = searchParams.get("building")

  const {
    messages,
    sendMessage,
    deleteMessage,
    editMessage,
    isSending,
    typingUsers,
    handleTypingStart,
    handleTypingStop,
    addReaction,
    removeReaction,
    markMessageAsRead,
  } = useBuildingMessages(buildingId ?? null)

  useEffect(() => {
    const loadBuilding = async () => {
      try {
        const supabase = createClient()

        // Get current user
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()
        if (userError || !user) {
          throw new Error(t("dashboard.errors.mustBeLoggedIn"))
        }

        setCurrentUserId(user.id)

        // If no building ID is provided, try to find the manager's building
        if (!buildingId) {
          const { data: managerBuilding, error: buildingError } = await supabase
            .from("buildings")
            .select("id, full_address, manager_id")
            .eq("manager_id", user.id)
            .limit(1)
            .single()

          if (buildingError || !managerBuilding) {
            throw new Error(
              t("dashboard.errors.noBuildingFound"),
            )
          }

          // Redirect to the same page with building ID
          window.location.href = `/management?building=${managerBuilding.id}`
          return
        }

        // Fetch building and verify ownership
        const { data, error } = await supabase
          .from("buildings")
          .select("id, full_address, manager_id")
          .eq("id", buildingId)
          .single()

        if (error) throw error

        // Verify the current user is the manager
        if (data.manager_id !== user.id) {
          throw new Error(t("dashboard.errors.notAuthorized"))
        }

        setBuilding(data)
      } catch (err: any) {
        console.error("Error loading building:", err)
        setBuilding(null)
      } finally {
        setLoading(false)
      }
    }

    loadBuilding()
  }, [buildingId, t])

  useEffect(() => {
    const loadNotices = async () => {
      if (!buildingId) return
      const supabase = createClient()
      const { data, error } = await supabase
        .from("notices")
        .select("id, title, event_date")
        .eq("building_id", buildingId)
        .order("event_date", { ascending: true })

      if (error) {
        console.error(t("dashboard.errors.loadingNotices"), error)
        return
      }

      setNotices(data || [])
    }

    loadNotices()
  }, [buildingId, t])
  const loadResidents = async () => {
    if (!buildingId) return

    try {
      const supabase = createClient()

      // First get building_residents data
      const { data: residentsData, error: residentsError } = await supabase
        .from("building_residents")
        .select("id, profile_id, apartment_number, resident_role, is_approved")
        .eq("building_id", buildingId)

      if (residentsError) throw residentsError

      if (!residentsData || residentsData.length === 0) {
        setResidents([])
        return
      }

      // Then get profile details
      const profileIds = residentsData.map(r => r.profile_id)
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", profileIds)

      if (profilesError) throw profilesError

      // Combine the data
      const mappedData = residentsData.map(resident => ({
        ...resident,
        profile: profilesData?.find(p => p.id === resident.profile_id) || null,
      }))

      setResidents(mappedData as Resident[])
    } catch (err: any) {
      console.error(t("dashboard.errors.loadingResidents"), err)
    }
  }

  const searchUsers = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .or(
          `first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`,
        )
        .limit(10)

      if (error) throw error
      setSearchResults(data || [])
    } catch (err: any) {
      console.error(t("dashboard.errors.searchingUsers"), err)
    } finally {
      setIsSearching(false)
    }
  }

  const addResident = async (profileId: string) => {
    if (!buildingId) return

    // Check if already added to the same apartment
    if (
      residents.some(
        r =>
          r.profile_id === profileId &&
          r.apartment_number === residentForm.apartmentNumber,
      )
    ) {
      alert(t("dashboard.errors.alreadyResident"))
      return
    }

    // Validate apartment number
    if (!residentForm.apartmentNumber.trim()) {
      alert(t("dashboard.errors.apartmentRequired"))
      return
    }

    // Validate apartment number length
    if (residentForm.apartmentNumber.length > 20) {
      alert(t("dashboard.errors.apartmentTooLong"))
      return
    }

    // Validate apartment number format - only alphanumeric, hyphens, periods, slashes, and spaces
    if (!/^[a-zA-Z0-9\-\.\/\s]+$/.test(residentForm.apartmentNumber)) {
      alert(t("dashboard.errors.apartmentInvalid"))
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.from("building_residents").insert({
        building_id: buildingId,
        profile_id: profileId,
        apartment_number: residentForm.apartmentNumber,
        resident_role: residentForm.residentRole,
        is_approved: true,
      })

      if (error) throw error

      // Reload residents list
      await loadResidents()
      setSearchQuery("")
      setSearchResults([])
      setResidentForm({
        profileId: null,
        apartmentNumber: "",
        residentRole: "resident",
      })
    } catch (err: any) {
      console.error("Error adding resident:", err)
      alert(t("dashboard.errors.addResidentFailed") + err.message)
    }
  }

  const removeResident = async (residentId: string) => {
    if (!confirm(t("dashboard.errors.confirmRemoveResident"))) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("building_residents")
        .delete()
        .eq("id", residentId)

      if (error) throw error

      // Reload residents list
      await loadResidents()
    } catch (err: any) {
      console.error("Error removing resident:", err)
      alert(t("dashboard.errors.removeResidentFailed") + err.message)
    }
  }

  const updateResident = async () => {
    if (!editingResident) return

    // Validate apartment number
    if (!editingResident.apartmentNumber.trim()) {
      alert(t("dashboard.errors.apartmentRequired"))
      return
    }

    // Validate apartment number length
    if (editingResident.apartmentNumber.length > 20) {
      alert(t("dashboard.errors.apartmentTooLong"))
      return
    }

    // Validate apartment number format - only alphanumeric, hyphens, periods, slashes, and spaces
    if (!/^[a-zA-Z0-9\-\.\/\s]+$/.test(editingResident.apartmentNumber)) {
      alert(
        "Apartment number contains invalid characters. Use only letters, numbers, hyphens, periods, slashes, and spaces.",
      )
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("building_residents")
        .update({
          apartment_number: editingResident.apartmentNumber,
          resident_role: editingResident.residentRole,
        })
        .eq("id", editingResident.id)

      if (error) throw error

      // Reload residents list
      await loadResidents()
      setEditingResident(null)
    } catch (err: any) {
      console.error("Error updating resident:", err)
      alert("Failed to update resident: " + err.message)
    }
  }

  useEffect(() => {
    if (showResidentsOverlay) {
      loadResidents()
    }
  }, [showResidentsOverlay, buildingId])

  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">Loading...</p>
      </div>
    )
  }

  if (!buildingId || !building) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg mb-2">Unable to load building</p>
          <p className="text-sm text-muted-foreground">
            You may not have permission to manage this building.
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Building Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">{building.full_address}</h1>
          <Button
            variant="outline"
            onClick={() => setShowResidentsOverlay(true)}
          >
            Add/View Residents
          </Button>
        </div>
      </div>

      {/* Residents Overlay */}
      {showResidentsOverlay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold">Residents</h2>
              <button
                onClick={() => setShowResidentsOverlay(false)}
                className="text-muted-foreground hover:text-foreground text-2xl"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Search Section */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Search and Add Resident
                </label>
                <Input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="mb-2"
                />

                {/* Search Results */}
                {searchQuery && searchResults.length > 0 && (
                  <div className="border rounded-md max-h-48 overflow-y-auto mb-4">
                    {searchResults.map(profile => (
                      <div
                        key={profile.id}
                        className="flex items-center justify-between p-3 hover:bg-muted border-b last:border-b-0 cursor-pointer"
                        onClick={() =>
                          setResidentForm(prev => ({
                            ...prev,
                            profileId: profile.id,
                          }))
                        }
                      >
                        <div>
                          <p className="font-medium">
                            {profile.first_name} {profile.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {profile.email}
                          </p>
                        </div>
                        <div className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                          {residentForm.profileId === profile.id
                            ? "Selected"
                            : "Select"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchQuery && !isSearching && searchResults.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    No users found
                  </p>
                )}

                {/* Resident Form */}
                {residentForm.profileId && (
                  <div className="border rounded-md p-4 bg-muted/30 mb-4">
                    <h4 className="font-semibold mb-3">Add Resident Details</h4>

                    <div className="mb-3">
                      <label className="block text-sm font-medium mb-1">
                        Apartment Number *
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g., 101, 2A, etc."
                        value={residentForm.apartmentNumber}
                        onChange={e =>
                          setResidentForm(prev => ({
                            ...prev,
                            apartmentNumber: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1">
                        Role
                      </label>
                      <select
                        value={residentForm.residentRole}
                        onChange={e =>
                          setResidentForm(prev => ({
                            ...prev,
                            residentRole: e.target.value as
                              | "resident"
                              | "apartment_owner",
                          }))
                        }
                        className="w-full border rounded px-3 py-2 text-sm"
                      >
                        <option value="resident">Resident</option>
                        <option value="apartment_owner">Apartment Owner</option>
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => addResident(residentForm.profileId!)}
                        disabled={!residentForm.apartmentNumber.trim()}
                      >
                        Add Resident
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setResidentForm({
                            profileId: null,
                            apartmentNumber: "",
                            residentRole: "resident",
                          })
                        }
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Current Residents List */}
              <div>
                <h3 className="text-lg font-semibold mb-3">
                  Current Residents
                </h3>
                {residents.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No residents added yet. Search and add residents above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {residents.map(resident => (
                      <div key={resident.id}>
                        {editingResident?.id === resident.id ? (
                          /* Edit Form */
                          <div className="border rounded-md p-4 bg-muted/50">
                            <h4 className="font-semibold mb-3">
                              Edit Resident: {resident.profile.first_name}{" "}
                              {resident.profile.last_name}
                            </h4>

                            <div className="mb-3">
                              <label className="block text-sm font-medium mb-1">
                                Apartment Number *
                              </label>
                              <Input
                                type="text"
                                value={editingResident.apartmentNumber}
                                onChange={e =>
                                  setEditingResident(prev =>
                                    prev
                                      ? {
                                          ...prev,
                                          apartmentNumber: e.target.value,
                                        }
                                      : null,
                                  )
                                }
                              />
                            </div>

                            <div className="mb-4">
                              <label className="block text-sm font-medium mb-1">
                                Role
                              </label>
                              <select
                                value={editingResident.residentRole}
                                onChange={e =>
                                  setEditingResident(prev =>
                                    prev
                                      ? {
                                          ...prev,
                                          residentRole: e.target.value as
                                            | "resident"
                                            | "apartment_owner",
                                        }
                                      : null,
                                  )
                                }
                                className="w-full border rounded px-3 py-2 text-sm"
                              >
                                <option value="resident">Resident</option>
                                <option value="apartment_owner">
                                  Apartment Owner
                                </option>
                              </select>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={updateResident}
                                disabled={
                                  !editingResident.apartmentNumber.trim()
                                }
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingResident(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* Display View */
                          <div className="flex items-center justify-between p-3 border rounded-md">
                            <div className="flex-1">
                              <p className="font-medium">
                                {resident.profile.first_name}{" "}
                                {resident.profile.last_name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {resident.profile.email}
                              </p>
                              <div className="flex gap-2 mt-1">
                                {resident.apartment_number && (
                                  <span className="text-xs bg-muted px-2 py-1 rounded">
                                    Apt: {resident.apartment_number}
                                  </span>
                                )}
                                <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                                  {resident.resident_role === "apartment_owner"
                                    ? "Apt. owner"
                                    : "Resident"}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setEditingResident({
                                    id: resident.id,
                                    apartmentNumber:
                                      resident.apartment_number || "",
                                    residentRole: resident.resident_role as
                                      | "resident"
                                      | "apartment_owner",
                                  })
                                }
                              >
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => removeResident(resident.id)}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex justify-center items-stretch gap-10 px-6 mt-8 mb-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 items-stretch justify-center w-full max-w-[2000px]">
          {/* Left: Notices + Calendar */}
          <section className="flex flex-col md:flex-row bg-card p-6 shadow-lg w-full lg:w-[60%] h-auto md:h-[500px] lg:h-[70vh] border border-border flex-shrink-0 rounded-lg">
            {/* Notices */}
            <div className="w-full md:w-1/2 h-[500px] md:h-auto pb-6 md:pb-0 md:pr-6 border-b md:border-b-0 md:border-r border-border flex flex-col overflow-y-auto">
              <NoticeBoard
                buildingId={buildingId}
                isManager={true}
              />
            </div>

            {/* Calendar */}
            <div className="w-full md:w-1/2 pt-6 md:pt-0 md:pl-6 flex justify-center items-center md:items-start">
              {buildingId ? (
                <BuildingCalendar buildingId={buildingId} />
              ) : (
                <div className="p-4 text-sm text-muted-foreground">
                  No building selected
                </div>
              )}
            </div>
          </section>

          {/* Right: Chat */}
          <ChatBox
            buildingName={building.full_address}
            messages={messages}
            currentUserId={currentUserId}
            onSendMessage={sendMessage}
            onDeleteMessage={deleteMessage}
            onEditMessage={editMessage}
            isSending={isSending}
            typingUsers={typingUsers}
            onTypingStart={handleTypingStart}
            onTypingStop={handleTypingStop}
            onAddReaction={addReaction}
            onRemoveReaction={removeReaction}
            onMarkAsRead={markMessageAsRead}
            headerAction={
              <Link
                href={`/management/messages?building=${buildingId}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:opacity-90 transition-opacity"
              >
                <MessageSquare className="h-4 w-4" />
                Direct Messages
              </Link>
            }
            className="w-full lg:w-[30%] h-[500px] lg:h-[70vh]"
          />
        </div>
      </main>

      {/* Empty space at bottom */}
      <div className="h-[10vh]" />
    </div>
  )
}

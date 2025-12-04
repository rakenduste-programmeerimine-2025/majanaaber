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
          throw new Error("You must be logged in to access this page")
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
              "No building found. Please create a building first.",
            )
          }

          // Redirect to the same page with building ID
          window.location.href = `/manager?building=${managerBuilding.id}`
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
          throw new Error("You are not authorized to manage this building")
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
  }, [buildingId])

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
        console.error("Error loading notices:", error)
        return
      }

      setNotices(data || [])
    }

    loadNotices()
  }, [buildingId])
  const loadResidents = async () => {
    if (!buildingId) return

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("building_residents")
        .select(
          `
          id,
          profile_id,
          apartment_number,
          resident_role,
          is_approved,
          profile:profiles(id, first_name, last_name, email)
        `,
        )
        .eq("building_id", buildingId)

      if (error) throw error
      // Map the data to match our Resident interface
      const mappedData = (data || []).map(item => ({
        ...item,
        profile: Array.isArray(item.profile) ? item.profile[0] : item.profile,
      }))
      setResidents(mappedData as Resident[])
    } catch (err: any) {
      console.error("Error loading residents:", err)
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
      console.error("Error searching users:", err)
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
      alert("This user is already a resident of this apartment")
      return
    }

    // Validate apartment number
    if (!residentForm.apartmentNumber.trim()) {
      alert("Please enter an apartment number")
      return
    }

    // Validate apartment number length
    if (residentForm.apartmentNumber.length > 20) {
      alert("Apartment number is too long (maximum 20 characters)")
      return
    }

    // Validate apartment number format - only alphanumeric, hyphens, periods, slashes, and spaces
    if (!/^[a-zA-Z0-9\-\.\/\s]+$/.test(residentForm.apartmentNumber)) {
      alert(
        "Apartment number contains invalid characters. Use only letters, numbers, hyphens, periods, slashes, and spaces.",
      )
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
      alert("Failed to add resident: " + err.message)
    }
  }

  const removeResident = async (residentId: string) => {
    if (!confirm("Are you sure you want to remove this resident?")) return

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
      alert("Failed to remove resident: " + err.message)
    }
  }

  const updateResident = async () => {
    if (!editingResident) return

    // Validate apartment number
    if (!editingResident.apartmentNumber.trim()) {
      alert("Please enter an apartment number")
      return
    }

    // Validate apartment number length
    if (editingResident.apartmentNumber.length > 20) {
      alert("Apartment number is too long (maximum 20 characters)")
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
          <p className="text-sm text-gray-600">
            You may not have permission to manage this building.
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Building Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700 px-6 py-4 mt-[10vh]">
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
          <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold">Residents</h2>
              <button
                onClick={() => setShowResidentsOverlay(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
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
                        className="flex items-center justify-between p-3 hover:bg-gray-50 border-b last:border-b-0 cursor-pointer"
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
                          <p className="text-sm text-gray-600">
                            {profile.email}
                          </p>
                        </div>
                        <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {residentForm.profileId === profile.id
                            ? "Selected"
                            : "Select"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchQuery && !isSearching && searchResults.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">No users found</p>
                )}

                {/* Resident Form */}
                {residentForm.profileId && (
                  <div className="border rounded-md p-4 bg-blue-50 mb-4">
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
                  <p className="text-gray-500 text-sm">
                    No residents added yet. Search and add residents above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {residents.map(resident => (
                      <div key={resident.id}>
                        {editingResident?.id === resident.id ? (
                          /* Edit Form */
                          <div className="border rounded-md p-4 bg-yellow-50">
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
                              <p className="text-sm text-gray-600">
                                {resident.profile.email}
                              </p>
                              <div className="flex gap-2 mt-1">
                                {resident.apartment_number && (
                                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                    Apt: {resident.apartment_number}
                                  </span>
                                )}
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
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
      <main className="flex justify-center items-start gap-10 px-6 mt-8">
        {/* Left: Notices + Calendar */}
        <section className="flex bg-white dark:bg-gray-800 p-6 shadow-lg w-[60%] h-[70vh] border border-gray-300 dark:border-gray-700">
          {/* Notices */}
          <div className="w-1/2 pr-6 border-r border-gray-300 dark:border-gray-700 flex flex-col">
            <NoticeBoard
              buildingId={buildingId}
              isManager={true}
            />
          </div>

          {/* Calendar */}
          <div className="w-1/2 pl-6">
            {buildingId ? (
              <BuildingCalendar buildingId={buildingId} />
            ) : (
              <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
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
              href={`/manager/messages?building=${buildingId}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              Direct Messages
            </Link>
          }
        />
      </main>

      {/* Empty space at bottom */}
      <div className="h-[10vh]" />
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { NoticeBoard } from "@/components/notice-board"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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

export default function ManagerDashboard() {
  const [messages, setMessages] = useState<string[]>([])
  const [input, setInput] = useState("")
  const [building, setBuilding] = useState<Building | null>(null)
  const [loading, setLoading] = useState(true)
  const [showResidentsOverlay, setShowResidentsOverlay] = useState(false)
  const [residents, setResidents] = useState<Resident[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [residentForm, setResidentForm] = useState<ResidentForm>({
    profileId: null,
    apartmentNumber: "",
    residentRole: "resident",
  })
  const searchParams = useSearchParams()
  const buildingId = searchParams.get("building")

  useEffect(() => {
    const loadBuilding = async () => {
      if (!buildingId) {
        setLoading(false)
        return
      }

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

    // Check if already added
    if (residents.some(r => r.profile_id === profileId)) {
      alert("This user is already a resident of this building")
      return
    }

    // Validate apartment number
    if (!residentForm.apartmentNumber.trim()) {
      alert("Please enter an apartment number")
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

  const sendMessage = () => {
    if (!input.trim()) return
    setMessages([...messages, input])
    setInput("")
  }

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
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Building Header */}
      <div className="bg-white border-b border-gray-300 px-6 py-4 mt-[10vh]">
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
                      <div
                        key={resident.id}
                        className="flex items-center justify-between p-3 border rounded-md"
                      >
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
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeResident(resident.id)}
                        >
                          Remove
                        </Button>
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
        <section className="flex bg-white p-6 shadow-lg w-[60%] h-[70vh] border border-gray-300">
          {/* Notices */}
          <div className="w-1/2 pr-6 border-r border-gray-300 flex flex-col">
            <NoticeBoard
              buildingId={buildingId}
              isManager={true}
            />
          </div>

          {/* Calendar */}
          <div className="w-1/2 pl-6 flex flex-col items-center">
            <div className="flex items-center justify-between w-full mb-3">
              <button>{"<"}</button>
              <h3 className="font-semibold">November 2025</h3>
              <button>{">"}</button>
            </div>
            <div className="grid grid-cols-7 gap-2 w-full">
              {[...Array(30)].map((_, i) => (
                <button
                  key={i}
                  className="p-2 bg-gray-100 rounded hover:bg-blue-100"
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Right: Chat + User Info */}
        <div className="flex flex-col w-[30%]">
          {/* Username + Icons + Nav buttons above the chat box */}
          <div className="flex flex-col mb-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-lg">John Doe</span>
                <div className="flex gap-2 text-xl">
                  <button>🏠</button>
                  <button>🔔</button>
                  <button>✉️</button>
                </div>
              </div>
            </div>
            <div className="flex justify-between mb-2">
              <button className="text-blue-600">Residents</button>
              <button className="text-blue-600">Invoices</button>
              <button className="text-blue-600">Documents</button>
              <button className="text-red-500">Log Out</button>
            </div>
          </div>

          {/* Chat box */}
          <section className="flex flex-col bg-white p-6 shadow-lg border border-gray-300 h-[70vh]">
            <h3 className="text-xl font-semibold mb-2">
              Talk to your neighbour
            </h3>
            <div className="flex-1 overflow-y-auto border p-2 mb-2 space-y-1">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className="bg-gray-100 p-2"
                >
                  {msg}
                </div>
              ))}
            </div>
            <div className="flex">
              <input
                type="text"
                className="border p-2 flex-1"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type a message..."
              />
              <button
                onClick={sendMessage}
                className="bg-blue-500 text-white px-4"
              >
                Send
              </button>
            </div>
          </section>
        </div>
      </main>

      {/* Empty space at bottom */}
      <div className="h-[10vh]" />
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

interface Profile {
  id: string
  first_name: string
  last_name: string
  email: string
  phone_number: string
  apartment_number: string
  role: string
  created_at: string
}

interface BuildingConnection {
  id: string
  full_address: string
  city: string
  type: "manager" | "resident"
  apartment_number?: string
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [buildings, setBuildings] = useState<BuildingConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Profile form state
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("User not authenticated")
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (error) throw error

      setProfile(data)
      setFirstName(data.first_name || "")
      setLastName(data.last_name || "")
      setPhoneNumber(data.phone_number || "")

      // Fetch buildings user manages
      const { data: managedBuildings } = await supabase
        .from("buildings")
        .select("id, full_address, city")
        .eq("manager_id", user.id)

      // Fetch buildings user is a resident of
      const { data: residentBuildings } = await supabase
        .from("building_residents")
        .select(
          `
          apartment_number,
          building:buildings(id, full_address, city)
        `,
        )
        .eq("profile_id", user.id)

      const allBuildings: BuildingConnection[] = []

      // Add managed buildings
      if (managedBuildings) {
        managedBuildings.forEach(b => {
          allBuildings.push({
            id: b.id,
            full_address: b.full_address,
            city: b.city,
            type: "manager",
          })
        })
      }

      // Add resident buildings
      if (residentBuildings) {
        residentBuildings.forEach(r => {
          const building = Array.isArray(r.building)
            ? r.building[0]
            : r.building
          if (building) {
            allBuildings.push({
              id: building.id,
              full_address: building.full_address,
              city: building.city,
              type: "resident",
              apartment_number: r.apartment_number,
            })
          }
        })
      }

      setBuildings(allBuildings)
    } catch (err: any) {
      setError(err.message || "Failed to load profile")
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("User not authenticated")
      }

      // Update profiles table
      const { data, error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          last_name: lastName,
          phone_number: phoneNumber,
        })
        .eq("id", user.id)
        .select()

      if (error) throw error

      if (!data || data.length === 0) {
        throw new Error("No profile was updated. Please try again.")
      }

      // Also update auth.users metadata (display name)
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      })

      if (authError) throw authError

      setSuccess("Profile updated successfully")
      loadProfile()
    } catch (err: any) {
      setError(err.message || "Failed to save profile")
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match")
      return
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters")
      return
    }

    setChangingPassword(true)

    try {
      const supabase = createClient()

      // Get current user's email
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user?.email) {
        throw new Error("Could not get user email")
      }

      // Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })

      if (signInError) {
        throw new Error("Current password is incorrect")
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) throw updateError

      setPasswordSuccess("Password changed successfully")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password")
    } finally {
      setChangingPassword(false)
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "building_manager":
        return "Building Manager"
      case "apartment_owner":
        return "Apartment Owner"
      case "resident":
        return "Resident"
      default:
        return role
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
          <p className="text-muted-foreground">
            Manage your account information
          </p>
        </div>

        {/* Profile Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSaveProfile}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile?.email || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  placeholder="+372 5555 5555"
                />
              </div>

              <div className="space-y-2">
                <Label>Account Type</Label>
                <div>
                  <Badge variant="secondary">
                    {getRoleLabel(profile?.role || "")}
                  </Badge>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {success && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-md">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    {success}
                  </p>
                </div>
              )}

              <Button
                type="submit"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleChangePassword}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              {passwordError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive">{passwordError}</p>
                </div>
              )}

              {passwordSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-md">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    {passwordSuccess}
                  </p>
                </div>
              )}

              <Button
                type="submit"
                variant="outline"
                disabled={changingPassword}
              >
                {changingPassword ? "Changing..." : "Change Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Account Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Role</span>
                <Badge variant="secondary">
                  {getRoleLabel(profile?.role || "")}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Member since</span>
                <span>
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>

              {/* Buildings Section */}
              <div className="pt-2 border-t">
                <span className="text-muted-foreground block mb-2">
                  Connected Buildings
                </span>
                {buildings.length === 0 ? (
                  <p className="text-muted-foreground italic">
                    No buildings connected
                  </p>
                ) : (
                  <div className="space-y-2">
                    {buildings.map(building => (
                      <div
                        key={`${building.type}-${building.id}`}
                        className="flex justify-between items-start gap-2 p-2 bg-muted/20 rounded"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">
                            {building.full_address}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {building.city}
                          </p>
                        </div>
                        <Badge
                          variant={
                            building.type === "manager" ? "default" : "outline"
                          }
                          className="shrink-0"
                        >
                          {building.type === "manager"
                            ? "Manager"
                            : `Apt ${building.apartment_number || "N/A"}`}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

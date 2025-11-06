"use client"

import { useState } from "react"
import { BuildingAddress, type BuildingAddressData } from "./building-address"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

interface AddBuildingFormProps {
  onSuccess?: () => void
}

export function AddBuildingForm({ onSuccess }: AddBuildingFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState<BuildingAddressData>({
    street_name: "",
    house_number: "",
    city: "",
    county: "",
    postal_code: "",
    apartment_count: "",
  })

  const handleInputChange = (
    field: keyof BuildingAddressData,
    value: string,
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // Validate required fields
      if (!formData.city || !formData.street_name) {
        throw new Error("Please fill in all required fields (Street, City)")
      }

      const buildingData = {
        name: `${formData.street_name} ${formData.house_number}`.trim(),
        street_name: formData.street_name,
        house_number: formData.house_number,
        city: formData.city,
        county: formData.county,
        postal_code: formData.postal_code,
        apartment_count: formData.apartment_count
          ? parseInt(formData.apartment_count)
          : null,
        full_address:
          `${formData.street_name} ${formData.house_number}, ${formData.city}`.trim(),
        manager_id: user?.id,
      }

      // Insert building
      const { data, error: insertError } = await supabase
        .from("buildings")
        .insert(buildingData)
        .select()
        .single()

      if (insertError) {
        throw insertError
      }

      console.log("Building added successfully:", data)

      // Reset form
      setFormData({
        street_name: "",
        house_number: "",
        city: "",
        county: "",
        postal_code: "",
        apartment_count: "",
      })

      // Call success callback
      if (onSuccess) {
        onSuccess()
      }
    } catch (err: any) {
      console.error("Error adding building:", err)
      setError(err.message || "Failed to add building")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Add New Building</CardTitle>
        <CardDescription>
          Enter the building address and details manually
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          {/* Building Address Form */}
          <BuildingAddress
            formData={formData}
            onInputChange={handleInputChange}
          />

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? "Adding Building..." : "Add Building"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

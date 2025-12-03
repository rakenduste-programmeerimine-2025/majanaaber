"use client"

import { useState } from "react"
import { BuildingAddress, type BuildingAddressData } from "./building-address"
import { EstonianAds, type EstonianAddressData } from "./estonian-ads"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
  const [useManualEntry, setUseManualEntry] = useState(false)
  const [selectedAddress, setSelectedAddress] =
    useState<EstonianAddressData | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state for manual entry
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
    setFormData((prev: BuildingAddressData) => ({ ...prev, [field]: value }))
    setError(null)
  }

  const handleAddressSelect = (address: EstonianAddressData) => {
    console.log("Address selected:", address)
    setSelectedAddress(address)
    setError(null)
  }

  const handleAddressError = (errorMessage: string) => {
    console.log("Address error:", errorMessage)
    setError(errorMessage)
    setSelectedAddress(null)
  }

  const handleClearSelection = () => {
    setSelectedAddress(null)
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

      // Prepare building data
      let buildingData: any

      if (useManualEntry) {
        // Validate required fields for manual entry
        if (!formData.city || !formData.street_name) {
          throw new Error("Please fill in all required fields (Street, City)")
        }

        buildingData = {
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
      } else {
        // Using ADS selection
        if (!selectedAddress) {
          throw new Error(
            "Please select an address using the Estonian address search",
          )
        }
        buildingData = {
          street_name: selectedAddress.street_name,
          house_number: selectedAddress.house_number,
          city: selectedAddress.city || "",
          county: selectedAddress.county,
          postal_code: selectedAddress.postal_code,
          full_address:
            selectedAddress.full_address ||
            `${selectedAddress.street_name} ${selectedAddress.house_number}, ${selectedAddress.city}`.trim(),
          ads_code: selectedAddress.ads_code,
          manager_id: user?.id,
        }
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

      // Reset form
      setSelectedAddress(null)
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
          Search for an address using the Estonian ADS system or enter manually
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          {/* Toggle between ADS and Manual Entry */}
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant={!useManualEntry ? "default" : "outline"}
              onClick={() => setUseManualEntry(false)}
            >
              Use Estonian Address Search
            </Button>
            <Button
              type="button"
              variant={useManualEntry ? "default" : "outline"}
              onClick={() => setUseManualEntry(true)}
            >
              Manual Entry
            </Button>
          </div>

          {/* ADS Component */}
          {!useManualEntry && (
            <div className="relative z-20">
              <Label>Search Address</Label>
              <div className="mt-2 mb-8">
                <EstonianAds
                  onAddressSelect={handleAddressSelect}
                  onError={handleAddressError}
                  height="60px"
                  mode={3}
                  language="et"
                />
              </div>
              {selectedAddress && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900 dark:text-green-100">
                        Selected Address:
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {selectedAddress.full_address}
                      </p>
                      {selectedAddress.postal_code && (
                        <p className="text-xs text-green-600 dark:text-green-400">
                          Postal Code: {selectedAddress.postal_code}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleClearSelection}
                      className="flex-shrink-0"
                    >
                      Change
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual Entry Form */}
          {useManualEntry && (
            <BuildingAddress
              formData={formData}
              onInputChange={handleInputChange}
            />
          )}

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

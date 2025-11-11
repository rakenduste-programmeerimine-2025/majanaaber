"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface BuildingAddressData {
  street_name: string
  house_number: string
  city: string
  county: string
  postal_code: string
  apartment_count: string
}

interface BuildingAddressProps {
  formData: BuildingAddressData
  onInputChange: (field: keyof BuildingAddressData, value: string) => void
}

export function BuildingAddress({
  formData,
  onInputChange,
}: BuildingAddressProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="street_name">Street Name *</Label>
          <Input
            id="street_name"
            type="text"
            value={formData.street_name}
            onChange={e => onInputChange("street_name", e.target.value)}
            placeholder="Sipelga tn"
            required
          />
        </div>
        <div>
          <Label htmlFor="house_number">House Number</Label>
          <Input
            id="house_number"
            type="text"
            value={formData.house_number}
            onChange={e => onInputChange("house_number", e.target.value)}
            placeholder="12"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="city">City *</Label>
          <Input
            id="city"
            type="text"
            value={formData.city}
            onChange={e => onInputChange("city", e.target.value)}
            placeholder="Tallinn"
            required
          />
        </div>
        <div>
          <Label htmlFor="county">County</Label>
          <Input
            id="county"
            type="text"
            value={formData.county}
            onChange={e => onInputChange("county", e.target.value)}
            placeholder="Harju maakond"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="postal_code">Postal Code</Label>
          <Input
            id="postal_code"
            type="text"
            value={formData.postal_code}
            onChange={e => onInputChange("postal_code", e.target.value)}
            placeholder="10119"
          />
        </div>
        <div>
          <Label htmlFor="apartment_count">Number of Apartments</Label>
          <Input
            id="apartment_count"
            type="number"
            value={formData.apartment_count}
            onChange={e => onInputChange("apartment_count", e.target.value)}
            placeholder="24"
            min="1"
          />
        </div>
      </div>
    </div>
  )
}

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
          <Label htmlFor="street_name">Street/Location Name *</Label>
          <Input
            id="street_name"
            type="text"
            value={formData.street_name}
            onChange={e => onInputChange("street_name", e.target.value)}
            placeholder="e.g., Sipelga tn or Kahuri (for rural)"
            required
          />
        </div>
        <div>
          <Label htmlFor="house_number">House/Building Number *</Label>
          <Input
            id="house_number"
            type="text"
            value={formData.house_number}
            onChange={e => onInputChange("house_number", e.target.value)}
            placeholder="e.g., 14"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="city">City/Village (Optional for rural)</Label>
          <Input
            id="city"
            type="text"
            value={formData.city}
            onChange={e => onInputChange("city", e.target.value)}
            placeholder="e.g., Tallinn or Kriimani küla"
          />
        </div>
        <div>
          <Label htmlFor="county">County/Municipality *</Label>
          <Input
            id="county"
            type="text"
            value={formData.county}
            onChange={e => onInputChange("county", e.target.value)}
            placeholder="e.g., Harju maakond or Kastre vald"
            required
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
            placeholder="e.g., 10119"
          />
        </div>
      </div>
    </div>
  )
}

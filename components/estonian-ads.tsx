"use client"

import { useEffect, useRef, useState } from "react"

export interface EstonianAddressData {
  street_name?: string
  house_number?: string
  city?: string
  county?: string
  postal_code?: string
  full_address?: string
  ads_code?: string
}

interface EstonianAdsProps {
  onAddressSelect?: (address: EstonianAddressData) => void
  containerId?: string
  width?: string
  height?: string
  mode?: number // 1 = search + map, 2 = search only, 3 = address input only
  language?: "et" | "en" | "ru"
}

declare global {
  interface Window {
    InAadress: any
  }
}

export function EstonianAds({
  onAddressSelect,
  containerId,
  width = "100%",
  height = "450px",
  mode = 3, // Address input only (no map)
  language = "et",
}: EstonianAdsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<any>(null)
  const callbackRef = useRef<
    ((address: EstonianAddressData) => void) | undefined
  >(onAddressSelect)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uniqueId] = useState(
    () =>
      containerId || `InAadressDiv-${Math.random().toString(36).substr(2, 9)}`,
  )

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onAddressSelect
  }, [onAddressSelect])

  useEffect(() => {
    // Check if the script is already loaded
    const checkScript = () => {
      if (typeof window !== "undefined" && window.InAadress) {
        setIsLoaded(true)
        return true
      }
      return false
    }

    // If already loaded, initialize
    if (checkScript()) {
      return
    }

    // Wait for script to load
    const interval = setInterval(() => {
      if (checkScript()) {
        clearInterval(interval)
      }
    }, 100)

    // Cleanup
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!isLoaded || !containerRef.current || instanceRef.current) return

    try {
      // Clear the container content
      if (containerRef.current) {
        containerRef.current.innerHTML = ""
      }

      // Initialize InAadress with callback reference
      const handleAddressSelect = (data: any) => {
        if (callbackRef.current && data) {
          // Map the InAadress response to our interface
          const addressData: EstonianAddressData = {
            street_name: data.tanav || data.liikluspind,
            house_number: data.nr,
            city: data.vald || data.linn,
            county: data.maakond,
            postal_code: data.zip,
            full_address: data.address || data.tanav_nr,
            ads_code: data.aadress_id?.toString(),
          }
          callbackRef.current(addressData)
        }
      }

      const config = {
        container: uniqueId,
        mode: mode,
        ihist: "1993", // Historical data from 1993
        appartment: 0, // Don't show apartment level
        lang: language,
        cb: handleAddressSelect,
      }

      instanceRef.current = new window.InAadress(config)

      setTimeout(() => {
        const container = document.querySelector(`#${uniqueId}`)
        if (container) {
          container.addEventListener("click", e => {
            const target = e.target as HTMLElement

            // Check if it's a dropdown item (span with title containing address)
            if (
              target.tagName === "SPAN" &&
              target.title &&
              target.id.startsWith("in_teh_")
            ) {
              const fullAddress = target.title
              const parts = fullAddress.split(", ")

              let streetPart = ""
              let city = ""
              let county = ""

              if (parts.length >= 3) {
                streetPart = parts[0] || ""
                county = parts[parts.length - 1] || ""
                // For Estonian addresses, prioritize recognizable city names
                // Common patterns: "street, district, city, county" or "street, settlement, municipality, county"
                if (parts.length === 4) {
                  // Check if third element looks like a major city (ends with common city identifiers)
                  const thirdPart = parts[2]
                  if (thirdPart.includes(" linn") || ["Tallinn", "Tartu", "Pärnu", "Narva"].some(city => thirdPart.includes(city))) {
                    // Use the recognized city, include district for context
                    city = parts.slice(1, parts.length - 1).join(", ")
                  } else {
                    // Otherwise join all middle parts
                    city = parts.slice(1, parts.length - 1).join(", ")
                  }
                } else {
                  // For other lengths, join all middle parts
                  city = parts.slice(1, parts.length - 1).join(", ")
                }
              }

              const streetMatch = streetPart.match(/^(.+?)\s+(\d+.*)$/)
              const streetName = streetMatch ? streetMatch[1] : streetPart
              const houseNumber = streetMatch ? streetMatch[2] : ""

              const addressData: EstonianAddressData = {
                street_name: streetName,
                house_number: houseNumber,
                city: city,
                county: county,
                full_address: fullAddress,
                ads_code: target.id.replace("in_teh_", ""),
              }

              if (callbackRef.current) {
                callbackRef.current(addressData)
              }
            }
          })
        }
      }, 1000)

      const style = document.createElement("style")
      style.textContent = `
        .inads-dropdown {
          position: absolute !important;
          z-index: 1000 !important;
          background: white !important;
          border: 1px solid #ccc !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
          max-height: 200px !important;
          overflow-y: auto !important;
        }
        .inads-item {
          padding: 8px 12px !important;
          cursor: pointer !important;
        }
        .inads-item:hover {
          background-color: #f5f5f5 !important;
        }
      `
      if (!document.head.querySelector("#inads-custom-styles")) {
        style.id = "inads-custom-styles"
        document.head.appendChild(style)
      }
    } catch (err) {
      console.error("Error initializing InAadress:", err)
      setError("Failed to initialize Estonian address search")
    }
  }, [isLoaded, uniqueId, mode, language])

  // Update callback when onAddressSelect changes
  useEffect(() => {
    if (instanceRef.current) {
      instanceRef.current.cb = (data: any) => {
        if (callbackRef.current && data) {
          const addressData: EstonianAddressData = {
            street_name: data.tanav || data.liikluspind,
            house_number: data.nr,
            city: data.vald || data.linn,
            county: data.maakond,
            postal_code: data.zip,
            full_address: data.address || data.tanav_nr,
            ads_code: data.aadress_id?.toString(),
          }
          callbackRef.current(addressData)
        }
      }
    }
  }, [onAddressSelect])

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy?.()
          instanceRef.current = null
        } catch (e) {
          // Silently handle cleanup errors
        }
      }
    }
  }, [])

  if (error) {
    return (
      <div className="p-4 border border-red-300 rounded-md bg-red-50 dark:bg-red-900/20">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center justify-center border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900"
      >
        <p className="text-gray-500">Loading Estonian address search...</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        id={uniqueId}
        style={{ width, height }}
        className="border border-gray-300 dark:border-gray-700 rounded-md relative z-10"
      />
    </div>
  )
}

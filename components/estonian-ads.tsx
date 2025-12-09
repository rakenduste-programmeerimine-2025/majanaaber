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
  onError?: (errorMessage: string) => void
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
  onError,
  containerId,
  width = "100%",
  height = "450px",
  mode = 3, // Address input only (no map)
  language = "et",
}: EstonianAdsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<any>(null)
  const observerRef = useRef<MutationObserver | null>(null)
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

    // Wait for script to load with a timeout
    let timeoutId: NodeJS.Timeout | null = null
    const interval = setInterval(() => {
      if (checkScript()) {
        clearInterval(interval)
        if (timeoutId) clearTimeout(timeoutId)
      }
    }, 100)

    // If script doesn't load within 5 seconds, show error
    timeoutId = setTimeout(() => {
      clearInterval(interval)
      console.warn(
        "Estonian address search script failed to load after 5 seconds",
      )
      setError(
        "Estonian address search unavailable. Please use manual address entry.",
      )
      if (onError) {
        onError(
          "Failed to reach address search service, please enter the address manually",
        )
      }
    }, 5000)

    // Cleanup
    return () => {
      clearInterval(interval)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [onError])

  useEffect(() => {
    if (!isLoaded || !containerRef.current || instanceRef.current) return

    try {
      // Clear the container content
      if (containerRef.current) {
        containerRef.current.innerHTML = ""
      }

      // Initialize InAadress
      const config = {
        container: uniqueId,
        mode: mode,
        ihist: "1993", // Historical data from 1993
        appartment: 0, // Don't show apartment level
        lang: language,
      }

      instanceRef.current = new window.InAadress(config)

      // Use MutationObserver to detect when dropdown items appear
      // Note: The InAadress library doesn't provide reliable official callbacks,
      // so we monitor DOM changes to detect when results are available.
      // This approach is more resilient than polling and reacts to real changes.
      const container = document.querySelector(`#${uniqueId}`)
      if (container) {
        let clickListenerAdded = false

        observerRef.current = new MutationObserver(() => {
          // Add click listener once when dropdown items first appear
          if (
            !clickListenerAdded &&
            container.querySelector('[id^="in_teh_"]')
          ) {
            clickListenerAdded = true

            container.addEventListener("click", (e: Event) => {
              const target = e.target as HTMLElement

              // Try to find the span with the address data
              let itemElement = target

              // If we clicked on an LI, find the SPAN child inside it
              if (target.tagName === "LI") {
                const span = target.querySelector('[id^="in_teh_"]')
                if (span) {
                  itemElement = span as HTMLElement
                }
              }
              // If we didn't click on the span directly, look for parent span
              else if (!target.id.startsWith("in_teh_")) {
                const parent = target.closest('[id^="in_teh_"]') as HTMLElement
                if (parent) {
                  itemElement = parent
                }
              }

              // Now we should have the SPAN element
              if (
                itemElement.tagName === "SPAN" &&
                itemElement.id.startsWith("in_teh_")
              ) {
                const title =
                  itemElement.title || itemElement.getAttribute("title")

                if (!title) {
                  return
                }

                // Parse the address from the title
                const fullAddress = title || ""

                // Extract address components from the full address string
                // Format: "Street number, District, City, County"
                const parts = fullAddress.split(", ")
                const firstPart = parts[0] || ""

                // Validate address specificity - reject village/municipality only selections
                const isJustVillage =
                  firstPart.includes("küla") &&
                  !firstPart.match(/^[^,]+(?=,\s*\w+\s+küla)/)
                const isJustMunicipality =
                  firstPart.includes("vald") || firstPart.includes("linn")

                // Check if address has sufficient detail:
                // - Urban: must have street name + number (e.g., "Sipelga tn 2")
                // - Rural: must have farm/building name before küla (e.g., "Andrese, Orgita küla")
                const hasStreetNumber = /\d+/.test(firstPart)
                const isFarmAddress =
                  parts.length >= 2 &&
                  parts[1]?.includes("küla") &&
                  !isJustVillage

                if (
                  isJustVillage ||
                  isJustMunicipality ||
                  (!hasStreetNumber && !isFarmAddress)
                ) {
                  if (onError) {
                    onError("Address too general, please specify building")
                  }
                  return
                }

                let streetPart = ""
                let city = ""
                let county = ""

                if (parts.length >= 3) {
                  streetPart = parts[0] || ""
                  county = parts[parts.length - 1] || ""
                  city = parts.slice(1, parts.length - 1).join(", ")
                }

                // Extract street name and house number from street part
                const streetMatch = streetPart.match(/^(.+?)\s+(\d+.*)$/)
                const streetName = streetMatch ? streetMatch[1] : streetPart
                const houseNumber = streetMatch ? streetMatch[2] : ""

                const addressData: EstonianAddressData = {
                  street_name: streetName,
                  house_number: houseNumber,
                  city: city,
                  county: county,
                  full_address: fullAddress,
                  ads_code: itemElement.id.replace("in_teh_", ""),
                }

                if (callbackRef.current) {
                  callbackRef.current(addressData)
                }
              }
            })
          }
        })

        // Watch for DOM changes in the container
        observerRef.current.observe(container, {
          childList: true,
          subtree: true,
          characterData: false,
        })
      } else {
        console.warn("Container not found:", uniqueId)
      }

      // Add custom CSS to ensure dropdown is properly positioned
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

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Clean up observer
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
      // Clean up InAadress instance
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
      <div className="p-4 border border-destructive/20 rounded-md bg-destructive/10">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center justify-center border border-border rounded-md bg-muted/20"
      >
        <p className="text-muted-foreground">
          Loading Estonian address search...
        </p>
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        id={uniqueId}
        style={{ width, height }}
        className="relative z-10 overflow-visible"
      />
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface CalendarEvent {
  id: string
  title: string
  event_date: string
}

export function BuildingCalendar({ buildingId }: { buildingId: string }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])

  const supabase = createClient()

  const loadEvents = async () => {
    const { data, error } = await supabase
      .from("notices")
      .select("id, title, event_date")
      .eq("building_id", buildingId)
      .not("event_date", "is", null)

    if (!error) {
      setEvents(data || [])
    }
  }

  useEffect(() => {
    if (buildingId) {
      loadEvents()

      // Set up real-time subscription for notices changes
      const channel = supabase.channel(`calendar_events_${buildingId}`)

      // Subscribe to INSERT events
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notices",
          filter: `building_id=eq.${buildingId}`,
        },
        (payload) => {
          if (payload.new?.event_date) {
            loadEvents()
          }
        }
      )

      // Subscribe to UPDATE events  
      channel.on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public", 
          table: "notices",
          filter: `building_id=eq.${buildingId}`,
        },
        (payload) => {
          // Reload if event_date was added, removed, or changed
          if (payload.old?.event_date || payload.new?.event_date) {
            loadEvents()
          }
        }
      )

      // Subscribe to DELETE events
      channel.on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notices", 
          filter: `building_id=eq.${buildingId}`,
        },
        (payload) => {
          // Always reload on delete since we can't check if deleted notice had event_date
          loadEvents()
        }
      )

      channel.subscribe()

      // Fallback: Listen to local events from notice board as backup
      const handleNoticeDeleted = (data: { buildingId: string }) => {
        if (data.buildingId === buildingId) {
          loadEvents()
        }
      }

      // Dynamically import to avoid dependency issues
      import("@/lib/events").then(({ eventBus, EVENTS }) => {
        eventBus.on(EVENTS.NOTICE_DELETED, handleNoticeDeleted)
      })

      return () => {
        channel.unsubscribe()
        
        // Clean up event bus listener
        import("@/lib/events").then(({ eventBus, EVENTS }) => {
          eventBus.off(EVENTS.NOTICE_DELETED, handleNoticeDeleted)
        })
      }
    }
  }, [buildingId])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const daysArray = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const goPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const goNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const formatYMD = (y: number, m: number, d: number) => {
    const mm = String(m + 1).padStart(2, "0")
    const dd = String(d).padStart(2, "0")
    return `${y}-${mm}-${dd}`
  }

  return (
    <div className="w-full max-w-[500px] pl-6 flex flex-col items-center">
      {/* Header */}
      <div className="flex items-center justify-between w-full mb-3">
        <button onClick={goPrevMonth}>{"<"}</button>

        <h3 className="font-semibold">
          {currentDate.toLocaleString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </h3>

        <button onClick={goNextMonth}>{">"}</button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-2 w-full text-center text-xs font-semibold mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7 gap-2 w-full">
        {daysArray.map((day, idx) => {
          if (day === null) return <div key={idx}></div> // empty padding cell

          const dateStr = formatYMD(year, month, day)
          const dayEvents = events.filter(ev => {
            const evDate = ev.event_date?.split("T")[0] ?? ev.event_date
            return evDate === dateStr
          })

          // Check if this is today
          const today = new Date()
          const isToday =
            today.getFullYear() === year &&
            today.getMonth() === month &&
            today.getDate() === day

          return (
            <button
              key={idx}
              className={`p-2 rounded text-sm relative transition-colors
                  ${
                    isToday
                      ? "bg-blue-500 text-white font-semibold hover:bg-blue-600"
                      : dayEvents.length > 0
                        ? "bg-primary/20 hover:bg-primary/30"
                        : "bg-muted/30 hover:bg-muted/50"
                  }
                  `}
            >
              {day}

              {/* Small event dots */}
              {dayEvents.length > 0 && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                  {dayEvents.slice(0, 3).map(ev => (
                    <div
                      key={ev.id}
                      className={`w-1.5 h-1.5 rounded-full ${
                        isToday ? "bg-white" : "bg-primary"
                      }`}
                    ></div>
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

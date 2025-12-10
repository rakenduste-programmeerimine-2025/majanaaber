// Simple event system for coordinating between components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventCallback = (data?: any) => void

class EventBus {
  private events: { [key: string]: EventCallback[] } = {}

  on(event: string, callback: EventCallback) {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(callback)
  }

  off(event: string, callback: EventCallback) {
    if (!this.events[event]) return
    this.events[event] = this.events[event].filter(cb => cb !== callback)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit(event: string, data?: any) {
    if (!this.events[event]) return
    this.events[event].forEach(callback => callback(data))
  }
}

export const eventBus = new EventBus()

// Event types
export const EVENTS = {
  NOTICE_DELETED: "notice:deleted",
} as const

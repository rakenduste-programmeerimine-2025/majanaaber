// Simple event system for coordinating between components
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

  emit(event: string, data?: any) {
    if (!this.events[event]) return
    this.events[event].forEach(callback => callback(data))
  }
}

export const eventBus = new EventBus()

// Event types
export const EVENTS = {
  NOTICE_DELETED: 'notice:deleted',
  NOTICE_CREATED: 'notice:created', 
  NOTICE_UPDATED: 'notice:updated',
} as const
export function formatTimestamp(timestamp: string): string {
  const messageDate = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const messageDay = new Date(
    messageDate.getFullYear(),
    messageDate.getMonth(),
    messageDate.getDate(),
  )

  if (messageDay.getTime() === today.getTime()) {
    return messageDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (messageDay.getTime() === yesterday.getTime()) {
    return `Yesterday ${messageDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`
  }

  return `${messageDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
  })} ${messageDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`
}

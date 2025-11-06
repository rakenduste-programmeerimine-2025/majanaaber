"use client"

import { useState } from "react"

export default function ManagerDashboard() {
  const [messages, setMessages] = useState<string[]>([])
  const [input, setInput] = useState("")

  const sendMessage = () => {
    if (!input.trim()) return
    setMessages([...messages, input])
    setInput("")
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="flex justify-center items-start gap-10 px-6 mt-[15vh]">
        {/* Left: Notices + Calendar */}
        <section className="flex bg-white p-6 shadow-lg w-[60%] h-[70vh] border border-gray-300">
          {/* Notices */}
          <div className="w-1/2 pr-6 border-r border-gray-300 flex flex-col">
            <h2 className="text-xl font-bold mb-3">Apartment #12</h2>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Notices</h3>
              <button className="bg-blue-500 text-white px-3 py-1 rounded">
                + Add Notice
              </button>
            </div>
            <ul className="space-y-2 overflow-y-auto max-h-[60vh]">
              <li className="p-2 bg-gray-100 rounded">
                Water shutoff on Nov 7
              </li>
              <li className="p-2 bg-gray-100 rounded">
                Elevator maintenance Nov 10
              </li>
            </ul>
          </div>

          {/* Calendar */}
          <div className="w-1/2 pl-6 flex flex-col items-center">
            <div className="flex items-center justify-between w-full mb-3">
              <button>{"<"}</button>
              <h3 className="font-semibold">November 2025</h3>
              <button>{">"}</button>
            </div>
            <div className="grid grid-cols-7 gap-2 w-full">
              {[...Array(30)].map((_, i) => (
                <button
                  key={i}
                  className="p-2 bg-gray-100 rounded hover:bg-blue-100"
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Right: Chat + User Info */}
        <div className="flex flex-col w-[30%]">
          {/* Username + Icons + Nav buttons above the chat box */}
          <div className="flex flex-col mb-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-lg">John Doe</span>
                <div className="flex gap-2 text-xl">
                  <button>🏠</button>
                  <button>🔔</button>
                  <button>✉️</button>
                </div>
              </div>
            </div>
            <div className="flex justify-between mb-2">
              <button className="text-blue-600">Residents</button>
              <button className="text-blue-600">Invoices</button>
              <button className="text-blue-600">Documents</button>
              <button className="text-red-500">Log Out</button>
            </div>
          </div>

          {/* Chat box */}
          <section className="flex flex-col bg-white p-6 shadow-lg border border-gray-300 h-[70vh]">
            <h3 className="text-xl font-semibold mb-2">
              Talk to your neighbour
            </h3>
            <div className="flex-1 overflow-y-auto border p-2 mb-2 space-y-1">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className="bg-gray-100 p-2"
                >
                  {msg}
                </div>
              ))}
            </div>
            <div className="flex">
              <input
                type="text"
                className="border p-2 flex-1"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type a message..."
              />
              <button
                onClick={sendMessage}
                className="bg-blue-500 text-white px-4"
              >
                Send
              </button>
            </div>
          </section>
        </div>
      </main>

      {/* Empty space at bottom */}
      <div className="h-[10vh]" />
    </div>
  )
}

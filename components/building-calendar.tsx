export function BuildingCalendar() {
  return (
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
            className="p-2 bg-gray-100 rounded hover:bg-blue-100 text-sm"
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  )
}

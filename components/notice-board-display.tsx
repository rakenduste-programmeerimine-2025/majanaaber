interface NoticeBoardDisplayProps {
  buildingName: string
}

export function NoticeBoardDisplay({ buildingName }: NoticeBoardDisplayProps) {
  return (
    <div className="w-1/2 pr-6 border-r border-gray-300 flex flex-col">
      <h2 className="text-xl font-bold mb-3">{buildingName}</h2>
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold">Notices</h3>
      </div>
      <ul className="space-y-2 overflow-y-auto max-h-[60vh]">
        <li className="p-2 bg-muted/20 rounded text-muted-foreground text-sm">
          No notices yet
        </li>
      </ul>
    </div>
  )
}

interface ProgressBarProps {
  known: number
  total: number
  className?: string
}

export function ProgressBar({ known, total, className = '' }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((known / total) * 100) : 0

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{known} / {total} знаю</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

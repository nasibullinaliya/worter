import { useLang } from '../context/LangContext'

interface ProgressBarProps {
  known: number
  total: number
  className?: string
}

export function ProgressBar({ known, total, className = '' }: ProgressBarProps) {
  const { t } = useLang()
  const pct = total > 0 ? Math.round((known / total) * 100) : 0

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="font-medium">
          {known} / {total} {t('dashboard.known')}
        </span>
        <span className="text-gray-400">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-indigo-100/60">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

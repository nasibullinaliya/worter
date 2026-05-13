import { Link } from 'react-router-dom'
import type { ReminderDto } from '../api/sets'
import { useLang } from '../context/LangContext'

interface Props {
  reminders: ReminderDto[]
}

export function ReviewBanner({ reminders }: Props) {
  const { t } = useLang()
  if (reminders.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base">🔔</span>
        <p className="text-sm font-semibold text-amber-900">
          {t('reminder.timeToReview')}
        </p>
      </div>
      <div className="space-y-2">
        {reminders.map((r) => (
          <div
            key={r.setId}
            className="flex items-center justify-between gap-2 rounded-lg border border-amber-100 bg-white px-3 py-2 shadow-sm"
          >
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
              {r.title}
            </p>
            <Link
              to={`/sets/${r.setId}/test`}
              className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              {t('test.startBtn')}
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}

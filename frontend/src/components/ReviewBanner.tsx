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
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        <svg
          className="h-4 w-4 text-violet-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0z"
          />
        </svg>
        <p className="text-sm font-semibold text-gray-700">
          {t('reminder.timeToReview')}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {reminders.map((r) => (
          <div
            key={r.setId}
            className="flex items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-white px-4 py-2.5 shadow-sm"
          >
            <p className="min-w-0 truncate text-sm font-medium text-gray-800">
              {r.title}
            </p>
            <Link
              to={`/sets/${r.setId}/test`}
              className="shrink-0 rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              {t('test.startBtn')}
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}

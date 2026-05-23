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
            className="rounded-xl border border-indigo-100 bg-white px-4 py-3 shadow-sm"
          >
            <p className="mb-2.5 truncate text-sm font-semibold text-gray-800">
              {r.title}
            </p>
            <div className="flex gap-2">
              <Link
                to={`/sets/${r.setId}/flashcards`}
                className="flex-1 rounded-full border border-violet-200 bg-violet-50 py-1.5 text-center text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors"
              >
                {t('plan.startStudy')}
              </Link>
              <Link
                to={`/sets/${r.setId}/test`}
                className="flex-1 rounded-full bg-violet-600 py-1.5 text-center text-xs font-semibold text-white hover:bg-violet-700 transition-colors"
              >
                {t('plan.startTest')}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

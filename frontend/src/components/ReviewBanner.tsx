import { Link } from 'react-router-dom'
import type { ReminderDto } from '../api/sets'
import { useLang } from '../context/LangContext'
import { FINAL_STAGE } from '../utils/srs'

interface Props {
  reminders: ReminderDto[]
}

export function ReviewBanner({ reminders }: Props) {
  const { t, wl } = useLang()
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
        {reminders.map((r) => {
          const isFinal = r.reviewStage === FINAL_STAGE
          return (
            <div
              key={r.setId}
              className="rounded-2xl border border-gray-100 bg-gray-50 p-4"
            >
              {/* Title */}
              <Link
                to={`/sets/${r.setId}`}
                className="mb-1 block truncate text-sm font-semibold text-gray-800 hover:text-violet-700 transition-colors"
              >
                {r.title}
              </Link>
              {/* Word count + stage pips */}
              <div className="flex items-center gap-1.5 mb-3">
                <p className="text-xs text-gray-400">{r.totalWords} {wl(r.totalWords)}</p>
                <span className="text-[10px] tracking-tight text-gray-300">
                  {Array.from({ length: FINAL_STAGE }, (_, i) => (
                    <span key={i}>{i < r.reviewStage ? '●' : '○'}</span>
                  ))}
                </span>
              </div>
              {/* Buttons */}
              <div className="flex gap-2">
                {!isFinal && (
                  <Link
                    to={`/sets/${r.setId}/study`}
                    className="flex-1 rounded-xl border border-violet-200 bg-violet-50 py-2 text-center text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors"
                  >
                    {t('plan.startStudy')}
                  </Link>
                )}
                <Link
                  to={isFinal ? `/sets/${r.setId}/test?final=1` : `/sets/${r.setId}/test`}
                  className="flex-1 rounded-xl bg-violet-600 py-2 text-center text-xs font-semibold text-white hover:bg-violet-700 transition-colors"
                >
                  {isFinal ? t('test.finalStageTitle') : t('plan.startTest')}
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

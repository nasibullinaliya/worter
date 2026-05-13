import { Link } from 'react-router-dom'
import type { ReminderDto } from '../api/sets'
import { useLang } from '../context/LangContext'

interface Props {
  reminders: ReminderDto[]
}

export function ReviewBanner({ reminders }: Props) {
  const { t, sl } = useLang()
  if (reminders.length === 0) return null

  const stageLabel = (stage: number) =>
    (t as (k: string) => string)(`stage.${stage}`) || t('stage.review')

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">🔔</span>
        <p className="font-semibold text-amber-900">
          {t('reminder.timeToReview')} {reminders.length} {sl(reminders.length)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {reminders.map((r) => (
          <Link
            key={r.setId}
            to={`/sets/${r.setId}/flashcards`}
            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-sm border border-amber-100 hover:border-amber-300 transition-colors"
          >
            <span className="font-medium text-gray-800">{r.title}</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {stageLabel(r.reviewStage)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

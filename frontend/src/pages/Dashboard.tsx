import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSets, getReminders, type SetSummaryDto, type ReminderDto } from '../api/sets'
import { Layout } from '../components/Layout'
import { ReviewBanner } from '../components/ReviewBanner'
import { ProgressBar } from '../components/ProgressBar'
import { useLang } from '../context/LangContext'

// SRS progression days shown in the UI
const STAGE_DAYS = [1, 2, 7, 14]

/** Pip row showing "1 / 2 / 7 / 14" with colour-coded progress. */
function StageProgress({ stage }: { stage: number }) {
  return (
    <span className="flex items-center font-mono text-xs">
      {STAGE_DAYS.map((day, i) => {
        let cls: string
        if (stage > STAGE_DAYS.length - 1) {
          // stage 4 = all complete
          cls = 'font-bold text-green-600'
        } else if (i < stage) {
          cls = 'font-bold text-green-600'   // done
        } else if (i === stage) {
          cls = 'font-bold text-gray-800'    // current (stage 0) or next due
        } else {
          cls = 'text-gray-300'              // future
        }
        return (
          <span key={day}>
            <span className={cls}>{day}</span>
            {i < STAGE_DAYS.length - 1 && (
              <span className="mx-0.5 text-gray-300">/</span>
            )}
          </span>
        )
      })}
    </span>
  )
}

export default function Dashboard() {
  const { t } = useLang()
  const [sets, setSets] = useState<SetSummaryDto[]>([])
  const [reminders, setReminders] = useState<ReminderDto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getSets(), getReminders()])
      .then(([s, r]) => { setSets(s); setReminders(r) })
      .finally(() => setLoading(false))
  }, [])

  return (
    <Layout reminderCount={reminders.length}>
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h2>
        <div className="flex gap-2">
          <Link
            to="/test"
            className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
          >
            {t('dashboard.studyAll')}
          </Link>
          <Link
            to="/quiz"
            className="rounded-lg border border-gray-400 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            {t('quiz.quizBtn')}
          </Link>
          <Link
            to="/sets/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {t('dashboard.newSet')}
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : sets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <p className="text-gray-500">{t('dashboard.noSets')}</p>
          <p className="mt-1 text-sm text-gray-400">
            <Link to="/sets/new" className="text-indigo-600 hover:underline">
              {t('dashboard.createFirst')}
            </Link>
          </p>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* ── Main: set cards ─────────────────────────────────── */}
          <div className="min-w-0 flex-1">
            {/* Reminder panel — mobile only (above cards) */}
            {reminders.length > 0 && (
              <div className="mb-6 lg:hidden">
                <ReviewBanner reminders={reminders} />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sets.map((set) => (
                <SetCard key={set.id} set={set} />
              ))}
            </div>
          </div>

          {/* ── Sidebar: reminder panel — desktop only ──────────── */}
          {reminders.length > 0 && (
            <div className="hidden w-72 shrink-0 lg:block">
              <div className="sticky top-6">
                <ReviewBanner reminders={reminders} />
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}

function SetCard({ set }: { set: SetSummaryDto }) {
  const { t, wl } = useLang()
  const p = set.progress

  return (
    <Link
      to={`/sets/${set.id}`}
      className="flex flex-col rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="flex-1 font-semibold text-gray-900 line-clamp-2 leading-snug">
          {set.title}
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
          set.isPublic ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {set.isPublic ? t('common.public') : t('common.private')}
        </span>
      </div>

      {/* Description */}
      {set.description && (
        <p className="mb-3 text-sm text-gray-500 line-clamp-1">{set.description}</p>
      )}

      {/* Progress */}
      {p ? (
        <ProgressBar known={p.knownCount} total={p.totalWords} className="mb-3" />
      ) : (
        <p className="mb-3 text-xs text-gray-400">{t('dashboard.notStudied')}</p>
      )}

      {/* Footer: word count + stage pips + saved badge */}
      <div className="mt-auto flex items-center justify-between">
        <span className="text-sm text-gray-500">{set.wordCount} {wl(set.wordCount)}</span>
        <div className="flex items-center gap-2">
          {p && <StageProgress stage={p.reviewStage} />}
          {!set.isOwner && (
            <span className="text-xs text-gray-400">{t('dashboard.saved')}</span>
          )}
        </div>
      </div>
    </Link>
  )
}

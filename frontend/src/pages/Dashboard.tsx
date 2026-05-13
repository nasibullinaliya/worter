import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSets, getReminders, deleteSet, type SetSummaryDto, type ReminderDto } from '../api/sets'
import { Layout } from '../components/Layout'
import { ReviewBanner } from '../components/ReviewBanner'
import { ProgressBar } from '../components/ProgressBar'
import { useLang } from '../context/LangContext'

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

  const handleDelete = async (id: string) => {
    if (!confirm(t('dashboard.deleteConfirm'))) return
    await deleteSet(id)
    setSets((prev) => prev.filter((s) => s.id !== id))
    setReminders((prev) => prev.filter((r) => r.setId !== id))
  }

  const dueIds = new Set(reminders.map((r) => r.setId))
  const dueSets = sets.filter((s) => dueIds.has(s.id))
  const otherSets = sets.filter((s) => !dueIds.has(s.id))

  return (
    <Layout reminderCount={reminders.length}>
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
      ) : (
        <>
          <ReviewBanner reminders={reminders} />

          {sets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
              <p className="text-gray-500">{t('dashboard.noSets')}</p>
              <p className="mt-1 text-sm text-gray-400">
                <Link to="/sets/new" className="text-indigo-600 hover:underline">
                  {t('dashboard.createFirst')}
                </Link>
              </p>
            </div>
          ) : (
            <>
              {dueSets.length > 0 && (
                <section className="mb-8">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-600">
                    {t('dashboard.dueToday')}
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {dueSets.map((set) => (
                      <SetCard key={set.id} set={set} onDelete={handleDelete} />
                    ))}
                  </div>
                </section>
              )}

              <section>
                {dueSets.length > 0 && (
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
                    {t('dashboard.allSets')}
                  </h3>
                )}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {otherSets.map((set) => (
                    <SetCard key={set.id} set={set} onDelete={handleDelete} />
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </Layout>
  )
}

function SetCard({ set, onDelete }: { set: SetSummaryDto; onDelete: (id: string) => void }) {
  const { t, wl } = useLang()
  const p = set.progress
  const stageKey = `stage.${p?.reviewStage}` as `stage.${number}`

  return (
    <div className="flex flex-col rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-start justify-between gap-2">
        <Link
          to={`/sets/${set.id}`}
          className="flex-1 font-semibold text-gray-900 hover:text-indigo-600 line-clamp-2"
        >
          {set.title}
        </Link>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
          set.isPublic ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {set.isPublic ? t('common.public') : t('common.private')}
        </span>
      </div>

      {set.description && (
        <p className="mb-2 text-sm text-gray-500 line-clamp-1">{set.description}</p>
      )}

      {p ? (
        <ProgressBar known={p.knownCount} total={p.totalWords} className="mb-3" />
      ) : (
        <p className="mb-3 text-xs text-gray-400">{t('dashboard.notStudied')}</p>
      )}

      <div className="mt-auto flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{set.wordCount} {wl(set.wordCount)}</span>
          {p && p.reviewStage < 5 && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[p.reviewStage]}`}>
              {(t as (k: string) => string)(stageKey)}
            </span>
          )}
          {p && p.reviewStage >= 5 && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              {t('dashboard.completed')}
            </span>
          )}
          {!set.isOwner && (
            <span className="text-xs text-gray-400">{t('dashboard.saved')}</span>
          )}
        </div>
        <div className="flex gap-2">
          {set.isOwner && (
            <Link to={`/sets/${set.id}/edit`} className="text-xs text-gray-500 hover:text-indigo-600">
              {t('common.edit')}
            </Link>
          )}
          {set.isOwner && (
            <button
              onClick={() => onDelete(set.id)}
              className="text-xs text-red-400 hover:text-red-600"
            >
              {t('common.delete')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const STAGE_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-purple-100 text-purple-700',
  'bg-green-100 text-green-700',
]

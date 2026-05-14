import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getReminders, type ReminderDto } from '../api/sets'
import { Layout } from '../components/Layout'
import { useLang } from '../context/LangContext'

export default function Today() {
  const { t, wl } = useLang()
  const navigate = useNavigate()
  const [reminders, setReminders] = useState<ReminderDto[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getReminders()
      .then(setReminders)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <Layout>
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div className="mx-auto max-w-lg py-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{t('today.title')}</h2>
          <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
            ← {t('nav.mySets')}
          </Link>
        </div>

        {reminders && reminders.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center shadow-sm">
            <span className="mb-3 text-4xl">✅</span>
            <p className="text-base font-semibold text-gray-700">{t('today.empty')}</p>
            <p className="mt-1 text-sm text-gray-400">{t('today.emptyDesc')}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            {(reminders ?? []).map((r, i) => (
              <div
                key={r.setId}
                className={`flex items-center gap-4 px-5 py-4 ${
                  i !== (reminders ?? []).length - 1 ? 'border-b' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{r.title}</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {r.totalWords} {wl(r.totalWords)}
                  </p>
                </div>
                <Link
                  to={`/sets/${r.setId}/test`}
                  className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  {t('test.startBtn')}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSets, getReminders, type SetSummaryDto, type ReminderDto } from '../api/sets'
import { getWeeklyProgress, type WeeklyDayDto } from '../api/progress'
import { Layout } from '../components/Layout'
import { ReviewBanner } from '../components/ReviewBanner'
import { ProgressBar } from '../components/ProgressBar'
import { useLang } from '../context/LangContext'

// SRS progression days shown in the UI
const STAGE_DAYS = [1, 2, 4, 7, 14]

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** Pip row showing "1 / 2 / 7 / 14" with colour-coded progress. */
function StageProgress({ stage }: { stage: number }) {
  const { t } = useLang()
  return (
    <span className="group relative flex items-center font-mono text-xs">
      {/* Tooltip */}
      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-xl border border-gray-100 bg-white/70 px-3 py-2 text-xs text-gray-400 shadow-sm backdrop-blur-sm group-hover:block">
        {t('dashboard.stageTooltip')}
      </span>
      {STAGE_DAYS.map((day, i) => {
        let cls: string
        if (stage > STAGE_DAYS.length - 1) {
          cls = 'font-bold text-violet-500'
        } else if (i < stage) {
          cls = 'font-bold text-violet-500'
        } else if (i === stage) {
          cls = 'font-bold text-gray-700'
        } else {
          cls = 'text-gray-300'
        }
        return (
          <span key={day}>
            <span className={cls}>{day}</span>
            {i < STAGE_DAYS.length - 1 && (
              <span className="mx-0.5 text-gray-200">/</span>
            )}
          </span>
        )
      })}
    </span>
  )
}

/** Weekly bar chart — words studied per day */
function WeeklyProgress({ data }: { data: WeeklyDayDto[] }) {
  const { t, wl } = useLang()
  const max = Math.max(...data.map(d => d.wordCount), 1)
  const BAR_HEIGHT = 72

  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 shadow-sm">
      <p className="mb-4 text-sm font-semibold text-gray-700">{t('dashboard.weeklyProgress')}</p>

      {/* Cursor-following tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 whitespace-nowrap rounded-xl border border-gray-100 bg-white/70 px-3 py-2 text-xs text-gray-400 shadow-sm backdrop-blur-sm"
          style={{ left: tooltip.x, top: tooltip.y + 14, transform: 'translateX(-50%)' }}
        >
          {tooltip.text}
        </div>
      )}

      <div className="flex gap-1.5">
        {data.map((d, i) => {
          const todayStr = new Date().toISOString().slice(0, 10)
          const isToday = d.date.slice(0, 10) === todayStr
          const barPx = d.wordCount > 0
            ? Math.max(Math.round((d.wordCount / max) * BAR_HEIGHT), 8)
            : 6
          const letter = DAY_LETTERS[new Date(d.date.slice(0, 10) + 'T12:00:00Z').getDay()]
          const tooltipText = `${t('dashboard.studied')} ${d.wordCount} ${wl(d.wordCount)}`
          return (
            <div
              key={i}
              className="flex flex-1 flex-col items-center gap-1 cursor-default"
              onMouseMove={(e) => setTooltip({ x: e.clientX, y: e.clientY, text: tooltipText })}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* Область баров фиксированной высоты — бар прижат ко дну */}
              <div className="flex w-full items-end" style={{ height: `${BAR_HEIGHT}px` }}>
                <div
                  className={`w-full rounded-t-full ${
                    d.wordCount > 0
                      ? isToday
                        ? 'bg-indigo-600'
                        : 'bg-indigo-300'
                      : 'bg-indigo-200'
                  }`}
                  style={{ height: `${barPx}px` }}
                />
              </div>
              {/* Подпись дня */}
              <span className={`text-xs leading-none ${isToday ? 'font-semibold text-indigo-700' : 'text-indigo-400'}`}>
                {letter}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { t } = useLang()
  const [sets, setSets] = useState<SetSummaryDto[]>([])
  const [reminders, setReminders] = useState<ReminderDto[]>([])
  const [weeklyData, setWeeklyData] = useState<WeeklyDayDto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getSets(), getReminders(), getWeeklyProgress()])
      .then(([s, r, w]) => { setSets(s); setReminders(r); setWeeklyData(w) })
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
            className="rounded-full border-2 border-[#6366F1] px-4 py-2 text-sm font-semibold text-[#4F46E5] hover:bg-indigo-50 transition-colors"
          >
            {t('dashboard.studyAll')}
          </Link>
          <Link
            to="/quiz"
            className="rounded-full border-2 border-[#6366F1] px-4 py-2 text-sm font-semibold text-[#4F46E5] hover:bg-indigo-50 transition-colors"
          >
            {t('quiz.quizBtn')}
          </Link>
          <Link
            to="/sets/new"
            className="rounded-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity transition-colors"
          >
            {t('dashboard.newSet')}
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
        </div>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* ── Set cards: 2 columns ── */}
          <div className="flex-1 min-w-0">
            <div className="grid gap-4 sm:grid-cols-2">
              {sets.map((set) => (
                <SetCard key={set.id} set={set} />
              ))}
              <CreateSetCard />
            </div>
          </div>

          {/* ── Sidebar: reminders + weekly progress ── */}
          <aside className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-4">
            {reminders.length > 0 && <ReviewBanner reminders={reminders} />}
            {weeklyData.length > 0 && <WeeklyProgress data={weeklyData} />}
          </aside>
        </div>
      )}
    </Layout>
  )
}

function CreateSetCard() {
  const { t } = useLang()
  return (
    <Link
      to="/sets/new"
      className="flex min-h-[140px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-4 transition-all hover:border-violet-400 hover:bg-violet-50"
    >
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-600">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <span className="text-sm font-semibold text-violet-600">{t('dashboard.newSet')}</span>
    </Link>
  )
}

function SetCard({ set }: { set: SetSummaryDto }) {
  const { t, wl } = useLang()
  const p = set.progress

  return (
    <Link
      to={`/sets/${set.id}`}
      className="flex flex-col rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="flex-1 font-semibold text-gray-900 line-clamp-2 leading-snug">
          {set.title}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            set.isPublic
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {set.isPublic ? t('common.public') : t('common.private')}
        </span>
      </div>

      {/* Description */}
      {set.description && (
        <p className="mb-2 text-sm text-gray-400 line-clamp-1">{set.description}</p>
      )}

      {/* Author name for saved sets */}
      {!set.isOwner && set.authorName && (
        <p className="mb-2 text-xs text-gray-400">
          {t('dashboard.by')} <span className="font-medium">{set.authorName}</span>
        </p>
      )}

      {/* Progress */}
      {p ? (
        <ProgressBar known={p.knownCount} total={p.totalWords} className="mb-3" />
      ) : (
        <p className="mb-3 text-xs text-gray-300">{t('dashboard.notStudied')}</p>
      )}

      {/* Footer: word count + stage pips */}
      <div className="mt-auto flex items-center justify-between">
        <span className="text-sm text-gray-400">
          {set.wordCount} {wl(set.wordCount)}
        </span>
        <div className="flex items-center gap-2">
          {p && <StageProgress stage={p.reviewStage} />}
        </div>
      </div>
    </Link>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSets, getReminders, type SetSummaryDto, type ReminderDto } from '../api/sets'
import { getWeeklyProgress, getMonthlyProgress, type WeeklyDayDto } from '../api/progress'
import { getWeeklyPlan, type PlanDayDto } from '../api/plan'
import { Layout } from '../components/Layout'
import { ReviewBanner } from '../components/ReviewBanner'
import { ProgressBar } from '../components/ProgressBar'
import { useLang } from '../context/LangContext'

// SRS progression days shown in the UI
export const STAGE_DAYS = [1, 2, 4, 7, 14]

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/**
 * Returns the CSS class for a single pip at index `i` given the current `stage`.
 *
 * Stage semantics (after adding the day-4 interval):
 *   stage 1 → day-1 review is PENDING   → pip 0 = current, pips 1-4 = future
 *   stage 2 → day-2 review is PENDING   → pip 0 = done,    pip 1 = current
 *   stage 3 → day-4 review is PENDING   → pips 0-1 = done, pip 2 = current
 *   stage 4 → day-7 review is PENDING   → pips 0-2 = done, pip 3 = current
 *   stage 5 → day-14 review is PENDING  → pips 0-3 = done, pip 4 = current
 *   stage 6 → cycle complete            → all pips = done (violet)
 *
 * Mapping: pip i is "done" when stage > i+1, "current" when stage === i+1.
 */
export function pipClass(stage: number, i: number): string {
  if (stage > STAGE_DAYS.length) return 'font-bold text-violet-500' // stage 6 = complete
  if (i < stage - 1)            return 'font-bold text-violet-500' // completed pip
  if (i === stage - 1)          return 'font-bold text-gray-700'   // current (due now)
  return 'text-gray-300'                                            // future pip
}

/** Pip row showing "1 / 2 / 4 / 7 / 14" with colour-coded progress. */
function StageProgress({ stage }: { stage: number }) {
  const { t } = useLang()
  return (
    <span className="group relative flex items-center font-mono text-xs">
      {/* Tooltip */}
      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-xl border border-gray-100 bg-white/70 px-3 py-2 text-xs text-gray-400 shadow-sm backdrop-blur-sm group-hover:block">
        {t('dashboard.stageTooltip')}
      </span>
      {STAGE_DAYS.map((day, i) => (
        <span key={day}>
          <span className={pipClass(stage, i)}>{day}</span>
          {i < STAGE_DAYS.length - 1 && (
            <span className="mx-0.5 text-gray-200">/</span>
          )}
        </span>
      ))}
    </span>
  )
}

/** Weekly/Monthly bar chart — words studied per day */
function ProgressWidget({ weeklyData }: { weeklyData: WeeklyDayDto[] }) {
  const { t, wl } = useLang()
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly')
  const [monthlyData, setMonthlyData] = useState<WeeklyDayDto[] | null>(null)
  const [loadingMonthly, setLoadingMonthly] = useState(false)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  const handleShowMonthly = async () => {
    if (!monthlyData) {
      setLoadingMonthly(true)
      try {
        const data = await getMonthlyProgress()
        setMonthlyData(data)
      } finally {
        setLoadingMonthly(false)
      }
    }
    setView('monthly')
  }

  const isWeekly = view === 'weekly'
  const data = isWeekly ? weeklyData : (monthlyData ?? [])
  const max = Math.max(...data.map(d => d.wordCount), 1)
  const BAR_HEIGHT = 72
  const _now = new Date()
  const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 shadow-sm">
      <p className="mb-4 text-sm font-semibold text-gray-700">
        {isWeekly ? t('dashboard.weeklyProgress') : t('dashboard.monthlyProgress')}
      </p>

      {/* Cursor-following tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 whitespace-nowrap rounded-xl border border-gray-100 bg-white/70 px-3 py-2 text-xs text-gray-400 shadow-sm backdrop-blur-sm"
          style={{ left: tooltip.x, top: tooltip.y + 14, transform: 'translateX(-50%)' }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Bars */}
      {loadingMonthly ? (
        <div className="flex justify-center" style={{ height: `${BAR_HEIGHT + 20}px` }}>
          <div className="h-5 w-5 animate-spin self-center rounded-full border-2 border-indigo-400 border-t-transparent" />
        </div>
      ) : (
        <div className={`flex ${isWeekly ? 'gap-1.5' : 'gap-0.5'}`}>
          {data.map((d, i) => {
            const isToday = d.date.slice(0, 10) === todayStr
            const barPx = d.wordCount > 0
              ? Math.max(Math.round((d.wordCount / max) * BAR_HEIGHT), 8)
              : 6
            const tooltipText = `${t('dashboard.studied')} ${d.wordCount} ${wl(d.wordCount)}`

            // Weekly: day letter; Monthly: day-of-month number every 5 positions
            let label: string
            if (isWeekly) {
              label = DAY_LETTERS[new Date(d.date.slice(0, 10) + 'T12:00:00Z').getDay()]
            } else {
              const dayNum = new Date(d.date.slice(0, 10) + 'T12:00:00Z').getDate()
              label = (i === 0 || i % 5 === 4 || isToday) ? String(dayNum) : ''
            }

            return (
              <div
                key={i}
                className="flex flex-1 flex-col items-center gap-1 cursor-default"
                onMouseMove={(e) => setTooltip({ x: e.clientX, y: e.clientY, text: tooltipText })}
                onMouseLeave={() => setTooltip(null)}
              >
                <div className="flex w-full items-end" style={{ height: `${BAR_HEIGHT}px` }}>
                  <div
                    className={`w-full rounded-t-full ${
                      d.wordCount > 0
                        ? isToday ? 'bg-indigo-600' : 'bg-indigo-300'
                        : 'bg-indigo-200'
                    }`}
                    style={{ height: `${barPx}px` }}
                  />
                </div>
                <span className={`leading-none ${isWeekly ? 'text-xs' : 'text-[9px]'} ${isToday ? 'font-semibold text-indigo-700' : 'text-indigo-400'}`}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Toggle link */}
      <div className="mt-4 border-t border-indigo-100 pt-3 text-center">
        {isWeekly ? (
          <button
            onClick={handleShowMonthly}
            disabled={loadingMonthly}
            className="text-xs font-semibold text-indigo-600 hover:underline disabled:opacity-50"
          >
            {t('dashboard.viewMonthly')}
          </button>
        ) : (
          <button
            onClick={() => setView('weekly')}
            className="text-xs font-semibold text-indigo-600 hover:underline"
          >
            ← {t('dashboard.viewWeekly')}
          </button>
        )}
      </div>
    </div>
  )
}

/** Weekly bar chart — words PLANNED per day (from SRS schedule) */
function PlanWidget() {
  const { t, wl } = useLang()
  const [data, setData] = useState<PlanDayDto[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; day: PlanDayDto } | null>(null)

  useEffect(() => {
    getWeeklyPlan()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  const max = Math.max(...(data ?? []).map((d) => d.totalWords), 1)
  const BAR_HEIGHT = 72
  const _now = new Date()
  const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`
  const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">{t('plan.weeklyPlan')}</p>
        <Link to="/plan" className="text-xs font-semibold text-violet-500 hover:underline">
          {t('plan.viewAll')} →
        </Link>
      </div>

      {/* Cursor-following tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-xl border border-gray-100 bg-white/90 px-3 py-2 text-xs shadow-md backdrop-blur-sm"
          style={{ left: tooltip.x, top: tooltip.y + 14, transform: 'translateX(-50%)' }}
        >
          <p className="font-semibold text-gray-700 mb-1">
            {tooltip.day.totalWords} {wl(tooltip.day.totalWords)}
          </p>
          {tooltip.day.sets.map((s) => (
            <p key={s.setId} className="text-gray-400">
              {s.title}
            </p>
          ))}
        </div>
      )}

      {/* Bars */}
      {loading ? (
        <div className="flex justify-center" style={{ height: `${BAR_HEIGHT + 20}px` }}>
          <div className="h-5 w-5 animate-spin self-center rounded-full border-2 border-violet-400 border-t-transparent" />
        </div>
      ) : (
        <div className="flex gap-1.5">
          {(data ?? []).map((d, i) => {
            const isToday = d.date.slice(0, 10) === todayStr
            const barPx = d.totalWords > 0
              ? Math.max(Math.round((d.totalWords / max) * BAR_HEIGHT), 8)
              : 6
            const label = DAY_LETTERS[new Date(d.date.slice(0, 10) + 'T12:00:00Z').getDay()]

            return (
              <div
                key={i}
                className="flex flex-1 flex-col items-center gap-1 cursor-default"
                onMouseMove={(e) => d.totalWords > 0 && setTooltip({ x: e.clientX, y: e.clientY, day: d })}
                onMouseLeave={() => setTooltip(null)}
              >
                <div className="flex w-full items-end" style={{ height: `${BAR_HEIGHT}px` }}>
                  <div
                    className={`w-full rounded-t-full ${
                      d.totalWords > 0
                        ? isToday ? 'bg-violet-600' : 'bg-violet-300'
                        : 'bg-violet-100'
                    }`}
                    style={{ height: `${barPx}px` }}
                  />
                </div>
                <span className={`leading-none text-xs ${isToday ? 'font-semibold text-violet-700' : 'text-violet-400'}`}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      )}
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
            {weeklyData.length > 0 && <ProgressWidget weeklyData={weeklyData} />}
            <PlanWidget />
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

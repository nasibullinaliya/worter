import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSets, getReminders, type SetSummaryDto, type ReminderDto } from '../api/sets'
import { getFolders, createFolder, updateFolder, deleteFolder, assignSetToFolder, removeSetFromFolder, type FolderDto } from '../api/folders'
import { getWeeklyProgress, getMonthlyProgress, type WeeklyDayDto } from '../api/progress'
import { getWeeklyPlan, getMonthlyPlan, type PlanDayDto } from '../api/plan'
import { Layout } from '../components/Layout'
import { ReviewBanner } from '../components/ReviewBanner'
import { ProgressBar } from '../components/ProgressBar'
import { useLang } from '../context/LangContext'
import { FINAL_STAGE } from '../utils/srs'

// SRS progression days shown in the UI
export const STAGE_DAYS = [1, 2, 4, 7, 14]

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function pipClass(stage: number, i: number): string {
  if (stage > STAGE_DAYS.length) return 'font-bold text-violet-500'
  if (i < stage - 1)            return 'font-bold text-violet-500'
  if (i === stage - 1)          return 'font-bold text-gray-700'
  return 'text-gray-300'
}

function StageProgress({ stage }: { stage: number }) {
  const { t } = useLang()
  return (
    <span className="group relative flex items-center font-mono text-xs">
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
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 whitespace-nowrap rounded-xl border border-gray-100 bg-white/70 px-3 py-2 text-xs text-gray-400 shadow-sm backdrop-blur-sm"
          style={{ left: tooltip.x, top: tooltip.y + 14, transform: 'translateX(-50%)' }}
        >
          {tooltip.text}
        </div>
      )}
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

function PlanWidget() {
  const { t, wl } = useLang()
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly')
  const [weeklyData, setWeeklyData] = useState<PlanDayDto[] | null>(null)
  const [monthlyData, setMonthlyData] = useState<PlanDayDto[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; day: PlanDayDto } | null>(null)

  useEffect(() => {
    getWeeklyPlan().then(setWeeklyData).finally(() => setLoading(false))
  }, [])

  const handleShowMonthly = async () => {
    if (!monthlyData) {
      setLoading(true)
      await getMonthlyPlan().then(setMonthlyData)
      setLoading(false)
    }
    setView('monthly')
  }

  const isWeekly = view === 'weekly'
  const data = isWeekly ? weeklyData : monthlyData
  const max = Math.max(...(data ?? []).map((d) => d.totalWords), 1)
  const BAR_HEIGHT = 72
  const _now = new Date()
  const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`
  const DAY_LETTERS_LOCAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">
          {isWeekly ? t('plan.weeklyPlan') : t('plan.monthlyPlan')}
        </p>
        <Link to="/plan" className="text-xs font-semibold text-violet-500 hover:underline">
          {t('plan.viewAll')} →
        </Link>
      </div>
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-xl border border-gray-100 bg-white/90 px-3 py-2 text-xs shadow-md backdrop-blur-sm"
          style={{ left: tooltip.x, top: tooltip.y + 14, transform: 'translateX(-50%)' }}
        >
          <p className="font-semibold text-gray-700 mb-1">
            {tooltip.day.totalWords} {wl(tooltip.day.totalWords)}
          </p>
          {tooltip.day.sets.map((s) => (
            <p key={s.setId} className="text-gray-400">{s.title}</p>
          ))}
        </div>
      )}
      {loading ? (
        <div className="flex justify-center" style={{ height: `${BAR_HEIGHT + 20}px` }}>
          <div className="h-5 w-5 animate-spin self-center rounded-full border-2 border-violet-400 border-t-transparent" />
        </div>
      ) : (
        <div className={`flex ${isWeekly ? 'gap-1.5' : 'gap-0.5'}`}>
          {(data ?? []).map((d, i) => {
            const isToday = d.date.slice(0, 10) === todayStr
            const barPx = d.totalWords > 0
              ? Math.max(Math.round((d.totalWords / max) * BAR_HEIGHT), 8)
              : 6
            let label: string
            if (isWeekly) {
              label = DAY_LETTERS_LOCAL[new Date(d.date.slice(0, 10) + 'T12:00:00Z').getDay()]
            } else {
              const dayNum = new Date(d.date.slice(0, 10) + 'T12:00:00Z').getDate()
              label = (i === 0 || i % 5 === 0 || i === 29) ? String(dayNum) : ''
            }
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
                <span className={`leading-none ${isWeekly ? 'text-xs' : 'text-[9px]'} ${isToday ? 'font-semibold text-violet-700' : 'text-violet-400'}`}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      )}
      <div className="mt-4 border-t border-violet-100 pt-3 text-center">
        {isWeekly ? (
          <button
            onClick={handleShowMonthly}
            disabled={loading}
            className="text-xs font-semibold text-violet-600 hover:underline disabled:opacity-50"
          >
            {t('plan.viewMonthly')}
          </button>
        ) : (
          <button
            onClick={() => setView('weekly')}
            className="text-xs font-semibold text-violet-600 hover:underline"
          >
            ← {t('plan.viewWeekly')}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Folder assignment dropdown (on set card) ─────────────────────────────────
function FolderDropdown({
  set,
  folders,
  onAssigned,
}: {
  set: SetSummaryDto
  folders: FolderDto[]
  onAssigned: (setId: string, folderId: string | null, folderName: string | null) => void
}) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleAssign = async (e: React.MouseEvent, folderId: string | null) => {
    e.preventDefault()
    e.stopPropagation()
    if (folderId) {
      await assignSetToFolder(folderId, set.id)
      const folder = folders.find(f => f.id === folderId)
      onAssigned(set.id, folderId, folder?.name ?? null)
    } else {
      await removeSetFromFolder(set.id)
      onAssigned(set.id, null, null)
    }
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative" onClick={e => e.preventDefault()}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v) }}
        className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors ${
          set.folderId
            ? 'border-violet-200 bg-violet-50 text-violet-600'
            : 'border-gray-200 text-gray-400 hover:bg-gray-50'
        }`}
        title={set.folderName ?? t('folder.assignFolder')}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
          {folders.map(f => (
            <button
              key={f.id}
              onClick={(e) => handleAssign(e, f.id)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-gray-50 ${set.folderId === f.id ? 'font-semibold text-violet-600' : 'text-gray-700'}`}
            >
              {set.folderId === f.id && (
                <svg className="h-3 w-3 text-violet-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span className={set.folderId === f.id ? '' : 'ml-5'}>{f.name}</span>
            </button>
          ))}
          {set.folderId && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button
                onClick={(e) => handleAssign(e, null)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-400 hover:bg-gray-50"
              >
                <span className="ml-5">{t('folder.removeFromFolder')}</span>
              </button>
            </>
          )}
          {folders.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400">{t('folder.noFolder')}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Inline folder name editor ────────────────────────────────────────────────
function FolderNameModal({
  initial,
  title,
  onConfirm,
  onCancel,
}: {
  initial: string
  title: string
  onConfirm: (name: string) => void
  onCancel: () => void
}) {
  const { t } = useLang()
  const [name, setName] = useState(initial)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-80 rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">{title}</h3>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onConfirm(name.trim()); if (e.key === 'Escape') onCancel() }}
          placeholder={t('folder.namePlaceholder')}
          className="mb-4 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="rounded-full border border-gray-200 px-4 py-1.5 text-xs text-gray-500 hover:bg-gray-50">
            {t('common.cancel')}
          </button>
          <button
            onClick={() => name.trim() && onConfirm(name.trim())}
            disabled={!name.trim()}
            className="rounded-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {initial ? t('folder.rename') : t('folder.create')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { t } = useLang()
  const [sets, setSets] = useState<SetSummaryDto[]>([])
  const [reminders, setReminders] = useState<ReminderDto[]>([])
  const [weeklyData, setWeeklyData] = useState<WeeklyDayDto[]>([])
  const [folders, setFolders] = useState<FolderDto[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFolder, setActiveFolder] = useState<string | null>(null) // null = All, 'completed' = special
  const [modal, setModal] = useState<{ type: 'create' | 'rename'; folder?: FolderDto } | null>(null)

  useEffect(() => {
    Promise.all([getSets(), getReminders(), getWeeklyProgress(), getFolders()])
      .then(([s, r, w, f]) => { setSets(s); setReminders(r); setWeeklyData(w); setFolders(f) })
      .finally(() => setLoading(false))
  }, [])

  const totalWords = sets.reduce((sum, s) => sum + s.wordCount, 0)
  const inProgressWords = sets
    .filter(s => s.progress && s.progress.reviewStage > 0 && s.progress.reviewStage <= FINAL_STAGE)
    .reduce((sum, s) => sum + s.wordCount, 0)
  const learnedWords = sets.reduce((sum, s) => {
    if (!s.progress) return sum
    if (s.progress.reviewStage > FINAL_STAGE) return sum + s.wordCount
    if (s.progress.reviewStage === FINAL_STAGE) return sum + s.progress.finalCompletedCount
    return sum
  }, 0)

  const completedSets = sets.filter(s => s.progress && s.progress.reviewStage > FINAL_STAGE)
  const showPills = sets.length > 0

  const filteredSets = activeFolder === null
    ? sets
    : activeFolder === 'completed'
    ? completedSets
    : sets.filter(s => s.folderId === activeFolder)

  const handleFolderAssigned = (setId: string, folderId: string | null, folderName: string | null) => {
    setSets(prev => prev.map(s => s.id === setId ? { ...s, folderId, folderName } : s))
    // Refresh folder set counts
    setFolders(prev => prev.map(f => ({
      ...f,
      setCount: sets.filter(s => s.id !== setId ? s.folderId === f.id : folderId === f.id).length
    })))
  }

  const handleCreateFolder = async (name: string) => {
    const f = await createFolder(name)
    setFolders(prev => [...prev, f].sort((a, b) => a.name.localeCompare(b.name)))
    setModal(null)
  }

  const handleRenameFolder = async (name: string) => {
    if (!modal?.folder) return
    const updated = await updateFolder(modal.folder.id, name)
    setFolders(prev => prev.map(f => f.id === updated.id ? updated : f).sort((a, b) => a.name.localeCompare(b.name)))
    setSets(prev => prev.map(s => s.folderId === updated.id ? { ...s, folderName: updated.name } : s))
    setModal(null)
  }

  const handleDeleteFolder = async (folder: FolderDto) => {
    if (!confirm(t('folder.deleteConfirm'))) return
    await deleteFolder(folder.id)
    setFolders(prev => prev.filter(f => f.id !== folder.id))
    setSets(prev => prev.map(s => s.folderId === folder.id ? { ...s, folderId: null, folderName: null } : s))
    if (activeFolder === folder.id) setActiveFolder(null)
  }

  return (
    <Layout reminderCount={reminders.length}>
      {/* Top bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            {totalWords} {t('dashboard.totalWords')}, {inProgressWords} {t('dashboard.inProgressWords')}, {learnedWords} {t('dashboard.learnedWords')}
          </p>
        </div>
        <div className="flex gap-2 sm:flex-shrink-0">
          <Link
            to="/study"
            className="flex-1 sm:flex-none text-center rounded-full border-2 border-[#6366F1] px-4 py-2 text-sm font-semibold text-[#4F46E5] hover:bg-indigo-50 transition-colors"
          >
            {t('dashboard.studyAll')}
          </Link>
          <Link
            to="/test"
            className="flex-1 sm:flex-none text-center rounded-full border-2 border-[#6366F1] px-4 py-2 text-sm font-semibold text-[#4F46E5] hover:bg-indigo-50 transition-colors"
          >
            {t('quiz.quizBtn')}
          </Link>
          <Link
            to="/sets/new"
            className="flex-1 sm:flex-none text-center rounded-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity transition-colors"
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
            {/* Filter pills */}
            {showPills && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {/* All pill */}
                <button
                  onClick={() => setActiveFolder(null)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    activeFolder === null
                      ? 'border-violet-600 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {t('folder.all')}
                </button>

                {/* Named folder pills */}
                {folders.map(folder => (
                  <span key={folder.id} className="group relative flex items-center">
                    <button
                      onClick={() => setActiveFolder(activeFolder === folder.id ? null : folder.id)}
                      className={`rounded-full border pl-3 pr-2 py-1 text-xs font-medium transition-colors ${
                        activeFolder === folder.id
                          ? 'border-violet-600 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {folder.name}
                    </button>
                    {/* Edit / delete buttons visible on hover */}
                    <span className="ml-1 hidden group-hover:flex items-center gap-0.5">
                      <button
                        onClick={() => setModal({ type: 'rename', folder })}
                        className="rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Rename"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteFolder(folder)}
                        className="rounded-full p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                        title="Delete"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  </span>
                ))}

                {/* Completed pill — always shown when there are completed sets */}
                {completedSets.length > 0 && (
                  <button
                    onClick={() => setActiveFolder(activeFolder === 'completed' ? null : 'completed')}
                    className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      activeFolder === 'completed'
                        ? 'border-violet-600 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                        : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                    }`}
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {t('dashboard.completed')}
                  </button>
                )}

                {/* New folder button */}
                <button
                  onClick={() => setModal({ type: 'create' })}
                  className="rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs text-gray-400 hover:border-violet-400 hover:text-violet-500 transition-colors"
                >
                  {t('folder.newFolder')}
                </button>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {filteredSets.map((set) => (
                <SetCard
                  key={set.id}
                  set={set}
                  folders={folders}
                  onFolderAssigned={handleFolderAssigned}
                />
              ))}
              {activeFolder !== 'completed' && <CreateSetCard />}
            </div>
          </div>

          {/* ── Sidebar ── */}
          <aside className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-4">
            {reminders.length > 0 && <ReviewBanner reminders={reminders} />}
            {weeklyData.length > 0 && <ProgressWidget weeklyData={weeklyData} />}
            <PlanWidget />
          </aside>
        </div>
      )}

      {/* Folder create/rename modal */}
      {modal && (
        <FolderNameModal
          initial={modal.type === 'rename' ? (modal.folder?.name ?? '') : ''}
          title={modal.type === 'create' ? t('folder.createTitle') : t('folder.renameTitle')}
          onConfirm={modal.type === 'create' ? handleCreateFolder : handleRenameFolder}
          onCancel={() => setModal(null)}
        />
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

function SetCard({
  set,
  folders,
  onFolderAssigned,
}: {
  set: SetSummaryDto
  folders: FolderDto[]
  onFolderAssigned: (setId: string, folderId: string | null, folderName: string | null) => void
}) {
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
        (p.reviewStage === FINAL_STAGE && p.finalCompletedCount > 0) || p.reviewStage > FINAL_STAGE
          ? <ProgressBar known={p.finalCompletedCount} total={set.wordCount} className="mb-3" />
          : <ProgressBar known={p.knownCount} total={p.totalWords} className="mb-3" />
      ) : (
        <p className="mb-3 text-xs text-gray-300">{t('dashboard.notStudied')}</p>
      )}

      {/* Footer: word count + stage pips (or "Completed" badge for stage 6+) */}
      <div className="mt-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 text-sm text-gray-400">
            {set.wordCount} {wl(set.wordCount)}
          </span>
          {folders.length > 0 && (
            <FolderDropdown set={set} folders={folders} onAssigned={onFolderAssigned} />
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {p && p.reviewStage > FINAL_STAGE ? (
            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
              ✓ {t('dashboard.completed')}
            </span>
          ) : (
            p && <StageProgress stage={p.reviewStage} />
          )}
        </div>
      </div>
    </Link>
  )
}

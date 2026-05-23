import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { getWeeklyPlan, rescheduleSet, type PlanDayDto, type PlanSetItemDto } from '../api/plan'
import { Layout } from '../components/Layout'
import { useLang } from '../context/LangContext'

// ── Helpers ───────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().slice(0, 10)
const isToday = (d: string) => d.slice(0, 10) === todayStr()
const isPast = (d: string) => d.slice(0, 10) < todayStr()

function getMondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getDayLetters(lang: string) {
  if (lang === 'ru') return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
  if (lang === 'de') return ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
}

function formatDate(dateStr: string, lang: string) {
  return new Date(dateStr.slice(0, 10) + 'T12:00:00Z').toLocaleDateString(
    lang === 'ru' ? 'ru-RU' : lang === 'de' ? 'de-DE' : 'en-US',
    { weekday: 'long', day: 'numeric', month: 'long' }
  )
}

function formatWeekLabel(monday: Date, lang: string): string {
  const sunday = addDays(monday, 6)
  const locale = lang === 'ru' ? 'ru-RU' : lang === 'de' ? 'de-DE' : 'en-US'
  const dayFrom = monday.getDate()
  const dayTo = sunday.getDate()
  const month = sunday.toLocaleDateString(locale, { month: 'long' })
  return `${dayFrom}–${dayTo} ${month}`
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({ day, onClose }: { day: PlanDayDto; onClose: () => void }) {
  const { t, wl, lang } = useLang()
  const past = isPast(day.date)
  const today = isToday(day.date)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${today ? 'text-violet-500' : past ? 'text-gray-300' : 'text-indigo-400'}`}>
              {today ? t('plan.today') : past ? t('plan.past') : t('plan.upcoming')}
            </p>
            <p className="mt-0.5 text-sm font-bold text-gray-800 capitalize">
              {formatDate(day.date, lang)}
            </p>
            {day.sets.length > 0 && (
              <p className="mt-0.5 text-xs text-gray-400">{day.totalWords} {wl(day.totalWords)}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-2 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {day.sets.length === 0 ? (
            <p className="text-sm text-gray-400 text-center pt-8">{t('plan.noReviews')}</p>
          ) : (
            day.sets.map((s) => (
              <div key={s.setId} className={`rounded-2xl border p-4 ${s.isOverdue ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-semibold text-gray-800 text-sm leading-snug">{s.title}</p>
                  {s.isOverdue && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                      {t('plan.overdue')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-1">{s.totalWords} {wl(s.totalWords)}</p>
                {s.isOverdue && (
                  <p className="text-[11px] text-amber-600 mb-3">
                    ⏳ {s.graceDaysLeft} {t('plan.graceDaysLeft')}
                  </p>
                )}
                {!past && (
                  <div className="flex gap-2 mt-1">
                    <Link
                      to={`/sets/${s.setId}/test`}
                      className={`flex-1 rounded-xl py-2 text-center text-xs font-semibold transition-colors ${
                        s.isOverdue
                          ? 'border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                          : 'border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100'
                      }`}
                      onClick={onClose}
                    >
                      {t('plan.startStudy')}
                    </Link>
                    <Link
                      to={`/sets/${s.setId}/quiz`}
                      className={`flex-1 rounded-xl py-2 text-center text-xs font-semibold text-white transition-colors ${
                        s.isOverdue ? 'bg-amber-500 hover:bg-amber-600' : 'bg-violet-600 hover:bg-violet-700'
                      }`}
                      onClick={onClose}
                    >
                      {t('plan.startTest')}
                    </Link>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {!past && day.sets.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-3">
            <p className="text-[11px] text-gray-300 text-center">{t('plan.dragHint')}</p>
          </div>
        )}
      </div>
    </>
  )
}

// ── Draggable chip ────────────────────────────────────────────────────────────

function DraggableChip({ set, dateStr, past }: { set: PlanSetItemDto; dateStr: string; past: boolean }) {
  const { t } = useLang()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${set.setId}::${dateStr}`,
    disabled: past,
  })

  const normalStyle = set.isOverdue
    ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      className={`rounded-lg px-2 py-1 text-[11px] font-medium leading-snug select-none transition-opacity ${
        past ? 'bg-gray-100 text-gray-400'
        : isDragging ? 'opacity-30'
        : `cursor-grab active:cursor-grabbing ${normalStyle}`
      }`}
      {...(!past ? listeners : {})}
      {...(!past ? attributes : {})}
      title={set.isOverdue
        ? `${set.title} — ${t('plan.overdue')}, ${set.graceDaysLeft} ${t('plan.graceDaysLeft')}`
        : set.title}
    >
      <span className="flex items-center gap-1 truncate">
        {set.isOverdue && <span className="shrink-0">⚠</span>}
        <span className="truncate">{set.title}</span>
      </span>
    </div>
  )
}

// ── Droppable day column ──────────────────────────────────────────────────────

function DroppableDayColumn({
  day, dayName, onClick, children,
}: {
  day: PlanDayDto; dayName: string; onClick: () => void; children: React.ReactNode
}) {
  const { wl, t } = useLang()
  const dateStr = day.date.slice(0, 10)
  const today = isToday(day.date)
  const past = isPast(day.date)
  const { setNodeRef, isOver } = useDroppable({ id: dateStr, disabled: past })
  const dayNum = new Date(dateStr + 'T12:00:00Z').getUTCDate()

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`flex flex-col rounded-2xl border p-3 min-h-[160px] transition-all cursor-pointer ${
        today ? 'border-violet-400 bg-violet-50 shadow-md'
        : past ? 'border-gray-100 bg-gray-50/60'
        : isOver ? 'border-violet-300 bg-violet-50/50 ring-2 ring-violet-200'
        : 'border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-gray-200'
      }`}
    >
      <div className="mb-2 select-none">
        <p className={`text-[11px] font-semibold uppercase tracking-wide ${today ? 'text-violet-500' : 'text-gray-400'}`}>
          {dayName}
        </p>
        <p className={`text-xl font-bold leading-none ${today ? 'text-violet-700' : past ? 'text-gray-300' : 'text-gray-800'}`}>
          {dayNum}
        </p>
      </div>

      <div className="flex flex-col gap-1.5 flex-1">
        {children}
        {isOver && (
          <div className="rounded-lg border-2 border-dashed border-violet-300 px-2 py-1 text-[11px] text-violet-400 text-center">
            {t('plan.dropHere')}
          </div>
        )}
      </div>

      {day.sets.length > 0 ? (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          <p className={`text-[10px] select-none ${today ? 'text-violet-400' : 'text-gray-300'}`}>
            {day.totalWords} {wl(day.totalWords)}
          </p>
          {day.sets.some((s) => s.isOverdue) && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 uppercase tracking-wide select-none">
              {t('plan.overdue')}
            </span>
          )}
        </div>
      ) : (
        !isOver && <p className="mt-auto text-[11px] text-gray-200 select-none">{t('plan.noReviews')}</p>
      )}
    </div>
  )
}

// ── Weekly view ───────────────────────────────────────────────────────────────

function WeekView({ data, onUpdateData }: { data: PlanDayDto[]; onUpdateData: (d: PlanDayDto[]) => void }) {
  const { lang, t, wl } = useLang()
  const dayLetters = getDayLetters(lang)
  const [activeItem, setActiveItem] = useState<{ set: PlanSetItemDto; dateStr: string } | null>(null)
  const [selectedDay, setSelectedDay] = useState<PlanDayDto | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragStart = (event: DragStartEvent) => {
    const [setId, dateStr] = String(event.active.id).split('::')
    const set = data.find((d) => d.date.slice(0, 10) === dateStr)?.sets.find((s) => s.setId === setId)
    if (set) setActiveItem({ set, dateStr })
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const item = activeItem
    setActiveItem(null)
    const { active, over } = event
    if (!over || !item) return

    const [setId, fromDate] = String(active.id).split('::')
    const toDate = String(over.id)
    if (fromDate === toDate) return
    if (toDate < todayStr()) return

    const movedSet = data.find((d) => d.date.slice(0, 10) === fromDate)?.sets.find((s) => s.setId === setId)
    if (!movedSet) return

    const snapshot = data
    onUpdateData(data.map((day) => {
      const key = day.date.slice(0, 10)
      if (key === fromDate) {
        const sets = day.sets.filter((s) => s.setId !== setId)
        return { ...day, sets, totalWords: sets.reduce((a, s) => a + s.totalWords, 0) }
      }
      if (key === toDate) {
        const sets = [...day.sets, { ...movedSet, isOverdue: false, graceDaysLeft: 0 }]
        return { ...day, sets, totalWords: sets.reduce((a, s) => a + s.totalWords, 0) }
      }
      return day
    }))

    try {
      await rescheduleSet(setId, toDate)
    } catch {
      onUpdateData(snapshot)
    }
  }

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>

        {/* Desktop: 7-column grid */}
        <div className="hidden sm:grid grid-cols-7 gap-2">
          {data.map((day, i) => (
            <DroppableDayColumn
              key={day.date}
              day={day}
              dayName={dayLetters[i]}
              onClick={() => setSelectedDay(day)}
            >
              {day.sets.map((set) => (
                <DraggableChip key={set.setId} set={set} dateStr={day.date.slice(0, 10)} past={isPast(day.date)} />
              ))}
            </DroppableDayColumn>
          ))}
        </div>

        {/* Mobile: vertical list */}
        <div className="flex flex-col gap-2 sm:hidden">
          {data.map((day, i) => {
            const today = isToday(day.date)
            const past = isPast(day.date)
            const dateStr = day.date.slice(0, 10)
            const dayNum = new Date(dateStr + 'T12:00:00Z').getUTCDate()
            return (
              <div
                key={day.date}
                onClick={() => setSelectedDay(day)}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 cursor-pointer transition-all ${
                  today ? 'border-violet-400 bg-violet-50 shadow-md'
                  : past ? 'border-gray-100 bg-gray-50/60'
                  : 'border-gray-100 bg-white shadow-sm hover:shadow-md'
                }`}
              >
                {/* Day + date */}
                <div className="w-12 shrink-0">
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${today ? 'text-violet-500' : 'text-gray-400'}`}>
                    {dayLetters[i]}
                  </p>
                  <p className={`text-lg font-bold leading-tight ${today ? 'text-violet-700' : past ? 'text-gray-300' : 'text-gray-800'}`}>
                    {dayNum}
                  </p>
                </div>

                {/* Chips */}
                <div className="flex flex-1 flex-wrap gap-1.5 min-w-0">
                  {day.sets.length === 0 ? (
                    <span className="text-xs text-gray-300">{t('plan.noReviews')}</span>
                  ) : (
                    day.sets.map((set) => (
                      <span
                        key={set.setId}
                        className={`rounded-lg px-2 py-0.5 text-[11px] font-medium ${
                          past ? 'bg-gray-100 text-gray-400'
                          : set.isOverdue ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        {set.isOverdue && <span className="mr-0.5">⚠</span>}
                        {set.title}
                      </span>
                    ))
                  )}
                </div>

                {/* Word count */}
                {day.sets.length > 0 && (
                  <p className={`shrink-0 text-xs tabular-nums ${today ? 'text-violet-400' : 'text-gray-300'}`}>
                    {day.totalWords} {wl(day.totalWords)}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeItem && (
            <div className="rounded-lg bg-indigo-100 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 shadow-lg ring-2 ring-violet-400 cursor-grabbing whitespace-nowrap">
              {activeItem.set.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {selectedDay && <DetailPanel day={selectedDay} onClose={() => setSelectedDay(null)} />}
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Plan() {
  const { t, lang } = useLang()

  const currentMonday = getMondayOf(new Date())
  const [monday, setMonday] = useState<Date>(currentMonday)
  const [data, setData] = useState<PlanDayDto[] | null>(null)
  const [loading, setLoading] = useState(true)

  const isCurrentWeek = toDateStr(monday) === toDateStr(currentMonday)

  const loadWeek = async (m: Date) => {
    setLoading(true)
    await getWeeklyPlan(toDateStr(m)).then(setData)
    setLoading(false)
  }

  useEffect(() => { loadWeek(currentMonday) }, [])

  const handlePrev = () => { const m = addDays(monday, -7); setMonday(m); loadWeek(m) }
  const handleNext = () => { const m = addDays(monday, 7);  setMonday(m); loadWeek(m) }
  const handleToday = () => { setMonday(currentMonday); loadWeek(currentMonday) }

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">{t('plan.title')}</h2>

        {/* Week navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            ←
          </button>
          <div className="flex items-center gap-2">
            <span className="min-w-[160px] text-center text-sm font-semibold text-gray-700">
              {formatWeekLabel(monday, lang)}
            </span>
            {!isCurrentWeek && (
              <button
                onClick={handleToday}
                className="text-xs font-semibold text-violet-500 hover:underline"
              >
                {t('plan.today')}
              </button>
            )}
          </div>
          <button
            onClick={handleNext}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            →
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
        </div>
      ) : data && data.every((d) => d.sets.length === 0) && isCurrentWeek ? (
        <div className="flex flex-col items-center py-20 text-gray-400">
          <svg className="mb-3 h-12 w-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <p className="text-sm font-medium">{t('plan.empty')}</p>
        </div>
      ) : data ? (
        <WeekView data={data} onUpdateData={setData} />
      ) : null}
    </Layout>
  )
}

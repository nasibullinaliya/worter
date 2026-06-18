import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../context/LangContext'
import { FINAL_STAGE } from '../utils/srs'

export interface NextSetInfo {
  setId: string
  title: string
  reviewStage: number
}

interface Props {
  nextSet: NextSetInfo
  defaultMode: 'study' | 'test'
}

export function NextSetButton({ nextSet, defaultMode }: Props) {
  const { t } = useLang()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'study' | 'test'>(defaultMode)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const isFinalStage = nextSet.reviewStage >= FINAL_STAGE

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const getUrl = (m: 'study' | 'test') => {
    if (isFinalStage) return `/sets/${nextSet.setId}/test?final=1`
    return m === 'study' ? `/sets/${nextSet.setId}/study` : `/sets/${nextSet.setId}/test`
  }

  const modeLabel = (m: 'study' | 'test') => {
    if (isFinalStage) return t('test.finalStageTitle')
    return m === 'study' ? t('plan.startStudy') : t('plan.startTest')
  }

  return (
    <div ref={ref} className="relative inline-flex rounded-lg overflow-hidden shadow-sm">
      <button
        onClick={() => navigate(getUrl(mode))}
        className="flex min-w-[160px] flex-col items-start bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] px-5 py-2.5 text-white hover:opacity-90 transition-opacity"
      >
        <span className="text-[11px] font-medium text-violet-200 leading-tight">
          {modeLabel(mode)} →
        </span>
        <span className="text-sm font-semibold leading-snug max-w-[200px] truncate">
          {nextSet.title}
        </span>
      </button>
      {!isFinalStage && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="border-l border-violet-400 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] px-2.5 text-white hover:opacity-80 transition-opacity"
          aria-label="Switch mode"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {(['study', 'test'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setOpen(false) }}
              className={`flex w-full items-center gap-2 px-4 py-2 text-sm text-left transition-colors hover:bg-gray-50 ${
                m === mode ? 'font-semibold text-violet-700' : 'text-gray-700'
              }`}
            >
              <span className="w-3 shrink-0 text-violet-600">{m === mode ? '✓' : ''}</span>
              {modeLabel(m)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

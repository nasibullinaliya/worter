import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getSet, getReminders, type SetDetailDto, type WordDto } from '../api/sets'
import { recordSession, type SetProgressDto } from '../api/progress'
import { ProgressBar } from '../components/ProgressBar'
import { SpeakButton } from '../components/SpeakButton'
import { NextSetButton, type NextSetInfo } from '../components/NextSetButton'
import { Layout } from '../components/Layout'
import { useLang } from '../context/LangContext'
import { speak, stopSpeech } from '../utils/speech'

const AUTOPLAY_KEY = 'fc_autoplay'
const FRONT_SIDE_KEY = 'fc_front_side'

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

export default function Flashcards() {
  const { id } = useParams<{ id: string }>()
  const { t, dateLocale } = useLang()

  const [set, setSet] = useState<SetDetailDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [cards, setCards] = useState<WordDto[]>([])

  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<Set<string>>(new Set())
  const [unknown, setUnknown] = useState<Set<string>>(new Set())

  const [done, setDone] = useState(false)
  const [result, setResult] = useState<SetProgressDto | null>(null)
  const [saving, setSaving] = useState(false)
  const [nextSet, setNextSet] = useState<NextSetInfo | undefined>()
  const [pressed, setPressed] = useState<'known' | 'unknown' | null>(null)
  const [autoPlay, setAutoPlay] = useState(() => localStorage.getItem(AUTOPLAY_KEY) === 'true')
  // 'term' = word on front (default), 'definition' = translation on front
  const [frontSide, setFrontSide] = useState<'term' | 'definition'>(
    () => (localStorage.getItem(FRONT_SIDE_KEY) as 'term' | 'definition') ?? 'term'
  )

  useEffect(() => {
    if (!id) return
    getSet(id)
      .then((s) => {
        setSet(s)
        setCards(shuffle(s.words))
      })
      .finally(() => setLoading(false))
  }, [id])

  // Auto-play front side text when card changes
  useEffect(() => {
    if (!autoPlay || done || !current) return
    const text = frontSide === 'term' ? current.term : current.definition
    const lang = frontSide === 'term' ? set?.language : undefined
    const timer = setTimeout(() => speak(text, lang), 150)
    return () => clearTimeout(timer)
  }, [index, autoPlay, done, frontSide])

  const toggleAutoPlay = () => {
    setAutoPlay((prev) => {
      const next = !prev
      localStorage.setItem(AUTOPLAY_KEY, String(next))
      return next
    })
  }

  const toggleFrontSide = () => {
    setFrontSide((prev) => {
      const next = prev === 'term' ? 'definition' : 'term'
      localStorage.setItem(FRONT_SIDE_KEY, next)
      return next
    })
    setFlipped(false)
  }

  const current = cards[index]
  const total = cards.length

  const flash = (which: 'known' | 'unknown', isKnown: boolean) => {
    setPressed(which)
    setTimeout(() => { setPressed(null); handleAnswer(isKnown) }, 150)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (done || !current || pressed) return
      if (e.key === 'ArrowLeft') flash('unknown', false)
      else if (e.key === 'ArrowRight') flash('known', true)
      else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        setFlipped((f) => !f)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [current, done, index, pressed])

  const handleAnswer = async (isKnown: boolean) => {
    if (!current) return

    const newKnown = new Set(known)
    const newUnknown = new Set(unknown)
    if (isKnown) newKnown.add(current.id)
    else newUnknown.add(current.id)

    setKnown(newKnown)
    setUnknown(newUnknown)
    setFlipped(false)
    stopSpeech()

    if (index + 1 >= total) {
      setSaving(true)
      try {
        const wordResults = [
          ...[...newKnown].map((wordId) => ({ wordId, errorCount: 0 })),
          ...[...newUnknown].map((wordId) => ({ wordId, errorCount: 1 })),
        ]
        const res = await recordSession(id!, wordResults)
        setResult(res)
        try {
          const reminders = await getReminders()
          const first = reminders[0]
          if (first) setNextSet({ setId: first.setId, title: first.title, reviewStage: first.reviewStage })
        } catch { /* non-critical */ }
      } catch { /* ignore */ }
      finally { setSaving(false) }
      setDone(true)
    } else {
      setTimeout(() => setIndex(index + 1), 150)
    }
  }

  const restart = () => {
    setCards(shuffle(set!.words))
    setIndex(0)
    setFlipped(false)
    setKnown(new Set())
    setUnknown(new Set())
    setDone(false)
    setResult(null)
  }

  if (loading) return (
    <Layout>
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
      </div>
    </Layout>
  )

  if (!set || set.words.length === 0) return (
    <Layout>
      <p className="text-gray-400">{t('fc.noWords')}</p>
    </Layout>
  )

  if (done) {
    const knownCount = known.size
    return (
      <Layout>
        <div className="mx-auto max-w-md py-10 text-center">
          <div className="mb-6 flex justify-center">
            {knownCount === total ? (
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            ) : knownCount >= total / 2 ? (
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-100">
                <svg className="h-8 w-8 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <svg className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </span>
            )}
          </div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">{t('fc.sessionDone')}</h2>
          <p className="mb-6 text-gray-500">
            {t('fc.known')} <strong className="text-violet-600">{knownCount}</strong>{' '}
            {t('common.outOf')} {total}
          </p>
          <ProgressBar known={knownCount} total={total} className="mb-8" />

          {result && (
            <p className="mb-6 text-sm text-gray-400">
              {t('common.nextReview')}{' '}
              {result.nextReviewAt
                ? new Date(result.nextReviewAt).toLocaleDateString(dateLocale)
                : t('common.courseDone')}
            </p>
          )}

          <div className="flex flex-col items-center gap-3">
            {nextSet && <NextSetButton nextSet={nextSet} defaultMode="study" />}
            <div className="flex justify-center gap-3">
              <button
                onClick={restart}
                className="rounded-full border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {t('fc.restart')}
              </button>
              <Link
                to={`/sets/${id}`}
                className="rounded-full border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {t('common.backToSet')}
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mx-auto max-w-lg">
        <div className="mb-4 flex items-center justify-between">
          <Link to={`/sets/${id}`} className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors">
            ← {set.title}
          </Link>
          <span className="text-sm text-gray-400">
            {index + 1} / {total}
          </span>
        </div>

        <ProgressBar known={known.size} total={total} className="mb-3" />

        {/* Toggles */}
        <div className="mb-4 flex justify-end gap-2">
          {/* Front side toggle */}
          <button
            onClick={toggleFrontSide}
            className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
            </svg>
            {frontSide === 'term' ? t('fc.frontTerm') : t('fc.frontDef')}
          </button>

          {/* Auto-play toggle */}
          <button
            onClick={toggleAutoPlay}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              autoPlay
                ? 'bg-violet-100 text-violet-700'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M7.557 2.066A.75.75 0 0 1 8 2.75v10.5a.75.75 0 0 1-1.248.56L3.59 11H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.59l3.162-2.81a.75.75 0 0 1 .805-.124ZM12.95 3.05a.75.75 0 1 0-1.06 1.06 5.5 5.5 0 0 1 0 7.78.75.75 0 1 0 1.06 1.06 7 7 0 0 0 0-9.9ZM10.828 5.172a.75.75 0 1 0-1.06 1.06 2.5 2.5 0 0 1 0 3.536.75.75 0 1 0 1.06 1.06 4 4 0 0 0 0-5.656Z" />
            </svg>
            {t('fc.autoPlay')}
          </button>
        </div>

        {/* Card — front/back driven by frontSide */}
        <div
          className="flip-scene mb-6 cursor-pointer"
          style={{ height: '280px' }}
          onClick={() => setFlipped(!flipped)}
        >
          <div className={`flip-inner ${flipped ? 'flipped' : ''}`}>
            {/* Front */}
            <div className="flip-front flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-8 shadow-md">
              <p className="mb-2 text-xs uppercase tracking-wide text-gray-300">
                {frontSide === 'term' ? t('fc.word') : t('fc.translation')}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-center text-3xl font-bold text-gray-900">
                  {frontSide === 'term' ? current?.term : current?.definition}
                </p>
                {current && (
                  <SpeakButton
                    text={frontSide === 'term' ? current.term : current.definition}
                    lang={frontSide === 'term' ? set?.language : undefined}
                    className="text-gray-400"
                  />
                )}
              </div>
              {/* Example shown only on term side */}
              {frontSide === 'term' && current?.example && (
                <p className="mt-3 text-center text-sm italic text-gray-400">{current.example}</p>
              )}
              <p className="mt-4 text-xs text-gray-300">{t('fc.flipHint')}</p>
            </div>

            {/* Back */}
            <div className="flip-back flex flex-col items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 p-8 shadow-md">
              <p className="mb-2 text-xs uppercase tracking-wide text-violet-400">
                {frontSide === 'term' ? t('fc.translation') : t('fc.word')}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-center text-3xl font-bold text-violet-900">
                  {frontSide === 'term' ? current?.definition : current?.term}
                </p>
                {current && (
                  <SpeakButton
                    text={frontSide === 'term' ? current.definition : current.term}
                    lang={frontSide === 'definition' ? set?.language : undefined}
                    className="text-violet-300"
                  />
                )}
              </div>
              {/* Example shown on back when definition is on front */}
              {frontSide === 'definition' && current?.example && (
                <p className="mt-3 text-center text-sm italic text-violet-400">{current.example}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => flash('unknown', false)}
            className={`flex-1 rounded-2xl border-2 py-3 text-sm font-semibold transition-colors ${
              pressed === 'unknown'
                ? 'border-red-400 bg-red-100 text-red-700'
                : 'border-red-200 text-red-500 hover:bg-red-50'
            }`}
          >
            ← {t('fc.dontKnow')}
          </button>
          <button
            onClick={() => flash('known', true)}
            className={`flex-1 rounded-2xl border-2 py-3 text-sm font-semibold transition-colors ${
              pressed === 'known'
                ? 'border-green-400 bg-green-100 text-green-700'
                : 'border-green-200 text-green-600 hover:bg-green-50'
            }`}
          >
            {t('fc.know')} →
          </button>
        </div>

        {saving && (
          <p className="mt-4 text-center text-sm text-gray-400">{t('fc.saving')}</p>
        )}
      </div>
    </Layout>
  )
}

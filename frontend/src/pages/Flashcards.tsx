import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getSet, type SetDetailDto, type WordDto } from '../api/sets'
import { recordSession, type SetProgressDto } from '../api/progress'
import { ProgressBar } from '../components/ProgressBar'
import { SpeakButton } from '../components/SpeakButton'
import { Layout } from '../components/Layout'
import { useLang } from '../context/LangContext'
import { stopSpeech } from '../utils/speech'

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
  const [pressed, setPressed] = useState<'known' | 'unknown' | null>(null)

  useEffect(() => {
    if (!id) return
    getSet(id).then((s) => {
      setSet(s)
      setCards(shuffle(s.words))
    }).finally(() => setLoading(false))
  }, [id])

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
        const res = await recordSession(id!, [...newKnown])
        setResult(res)
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    </Layout>
  )

  if (!set || set.words.length === 0) return (
    <Layout>
      <p className="text-gray-500">{t('fc.noWords')}</p>
    </Layout>
  )

  if (done) {
    const knownCount = known.size
    return (
      <Layout>
        <div className="mx-auto max-w-md py-10 text-center">
          <div className="mb-6 text-5xl">{knownCount === total ? '🎉' : knownCount >= total / 2 ? '👍' : '📚'}</div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">{t('fc.sessionDone')}</h2>
          <p className="mb-6 text-gray-500">
            {t('fc.known')} <strong className="text-indigo-600">{knownCount}</strong>{' '}
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

          <div className="flex justify-center gap-3">
            <button
              onClick={restart}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {t('fc.restart')}
            </button>
            <Link
              to={`/sets/${id}`}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {t('common.backToSet')}
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mx-auto max-w-lg">
        <div className="mb-4 flex items-center justify-between">
          <Link to={`/sets/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
            ← {set.title}
          </Link>
          <span className="text-sm text-gray-500">{index + 1} / {total}</span>
        </div>

        <ProgressBar known={known.size} total={total} className="mb-6" />

        <div
          className="flip-scene mb-6 cursor-pointer"
          style={{ height: '280px' }}
          onClick={() => setFlipped(!flipped)}
        >
          <div className={`flip-inner ${flipped ? 'flipped' : ''}`}>
            <div className="flip-front flex flex-col items-center justify-center rounded-2xl border bg-white p-8 shadow-md">
              <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">{t('fc.word')}</p>
              <div className="flex items-center gap-2">
                <p className="text-center text-3xl font-bold text-gray-900">{current?.term}</p>
                {current && <SpeakButton text={current.term} className="text-gray-400" />}
              </div>
              <p className="mt-4 text-xs text-gray-400">{t('fc.flipHint')}</p>
            </div>

            <div className="flip-back flex flex-col items-center justify-center rounded-2xl border bg-indigo-50 p-8 shadow-md">
              <p className="mb-2 text-xs uppercase tracking-wide text-indigo-400">{t('fc.translation')}</p>
              <div className="flex items-center gap-2">
                <p className="text-center text-3xl font-bold text-indigo-900">{current?.definition}</p>
                {current && <SpeakButton text={current.definition} className="text-indigo-300" />}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => flash('unknown', false)}
            className={`flex-1 rounded-xl border-2 py-3 text-sm font-semibold transition-colors ${
              pressed === 'unknown'
                ? 'border-red-400 bg-red-100 text-red-700'
                : 'border-red-200 text-red-600 hover:bg-red-50'
            }`}
          >
            ← {t('fc.dontKnow')}
          </button>
          <button
            onClick={() => flash('known', true)}
            className={`flex-1 rounded-xl border-2 py-3 text-sm font-semibold transition-colors ${
              pressed === 'known'
                ? 'border-green-400 bg-green-100 text-green-700'
                : 'border-green-200 text-green-600 hover:bg-green-50'
            }`}
          >
            {t('fc.know')} →
          </button>
        </div>

        {saving && <p className="mt-4 text-center text-sm text-gray-400">{t('fc.saving')}</p>}
      </div>
    </Layout>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAllWords, recordWordProgress } from '../api/progress'
import { QuizRunner } from '../components/QuizRunner'
import { Layout } from '../components/Layout'
import { useLang } from '../context/LangContext'
import type { TestWord } from '../utils/testEngine'

interface SetInfo {
  setId: string
  setTitle: string
  words: TestWord[]
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

export default function QuizAll() {
  const { t, wl } = useLang()

  const [sets, setSets] = useState<SetInfo[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set())
  const [sessionWords, setSessionWords] = useState<TestWord[] | null>(null)

  useEffect(() => {
    getAllWords()
      .then((items) => {
        const map = new Map<string, SetInfo>()
        for (const i of items) {
          if (!map.has(i.setId)) {
            map.set(i.setId, { setId: i.setId, setTitle: i.setTitle, words: [] })
          }
          map.get(i.setId)!.words.push({ wordId: i.wordId, setId: i.setId, term: i.term, definition: i.definition })
        }
        const result = [...map.values()]
        setSets(result)
        setSelectedSetIds(new Set(result.map((s) => s.setId)))
      })
      .catch(() => setError(t('test.loadError')))
      .finally(() => setLoading(false))
  }, [])

  const selectedWords = useMemo(
    () => (sets ?? []).filter((s) => selectedSetIds.has(s.setId)).flatMap((s) => s.words),
    [sets, selectedSetIds],
  )

  if (loading) return (
    <Layout>
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
      </div>
    </Layout>
  )

  if (error || !sets) return (
    <Layout>
      <div className="mx-auto max-w-md py-12 text-center">
        <p className="mb-4 text-gray-500">{error || t('test.loadError')}</p>
        <Link to="/dashboard" className="text-sm text-violet-600 hover:underline">← {t('test.home')}</Link>
      </div>
    </Layout>
  )

  if (sessionWords) {
    return (
      <Layout>
        <QuizRunner
          words={sessionWords}
          backLabel={t('test.backToSetup')}
          onBack={() => setSessionWords(null)}
          onComplete={(knownWordIds, unknownWordIds) => {
            const wordResults = [
              ...knownWordIds.map((wordId) => ({ wordId, errorCount: 0 })),
              ...unknownWordIds.map((wordId) => ({ wordId, errorCount: 1 })),
            ]
            recordWordProgress(wordResults).catch(() => {})
          }}
        />
      </Layout>
    )
  }

  const allSelected = sets.length > 0 && sets.every((s) => selectedSetIds.has(s.setId))

  const toggleSet = (setId: string) => {
    setSelectedSetIds((prev) => {
      const next = new Set(prev)
      if (next.has(setId)) next.delete(setId)
      else next.add(setId)
      return next
    })
  }

  return (
    <Layout>
      <div className="mx-auto max-w-md py-10">
        <div className="mb-6">
          <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
            ← {t('test.home')}
          </Link>
        </div>

        <h2 className="mb-6 text-2xl font-bold text-gray-900">{t('quiz.allTitle')}</h2>

        {/* Set selection */}
        <div className="mb-5 rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">{t('test.selectSets')}</p>
            <button
              onClick={() => setSelectedSetIds(allSelected ? new Set() : new Set(sets.map((s) => s.setId)))}
              className="text-xs text-violet-600 hover:underline"
            >
              {allSelected ? t('test.deselectAll') : t('test.selectAll')}
            </button>
          </div>
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {sets.map((s) => (
              <label key={s.setId} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50">
                <input
                    spellCheck={false}
                  type="checkbox"
                  checked={selectedSetIds.has(s.setId)}
                  onChange={() => toggleSet(s.setId)}
                  className="h-4 w-4 rounded border-gray-300 accent-violet-600"
                />
                <span className="flex-1 text-sm text-gray-800">{s.setTitle}</span>
                <span className="text-xs text-gray-400">{s.words.length} {wl(s.words.length)}</span>
              </label>
            ))}
          </div>
        </div>

        {selectedSetIds.size === 0 && (
          <p className="mb-4 text-sm text-red-500">{t('test.noSetsSelected')}</p>
        )}

        <button
          onClick={() => setSessionWords(shuffle(selectedWords))}
          disabled={selectedSetIds.size === 0 || selectedWords.length < 1}
          className="w-full rounded-lg bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {t('quiz.startBtn')} ({selectedWords.length} {wl(selectedWords.length)})
        </button>
      </div>
    </Layout>
  )
}

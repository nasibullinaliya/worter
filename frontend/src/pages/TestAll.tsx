import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAllWords } from '../api/progress'
import { TestRunner } from '../components/TestRunner'
import { Layout } from '../components/Layout'
import { useLang } from '../context/LangContext'
import type { Direction, TestWord } from '../utils/testEngine'

const MIN_WORDS = 2

interface SetInfo {
  setId: string
  setTitle: string
  words: TestWord[]
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

export default function TestAll() {
  const { t, wl } = useLang()

  const [sets, setSets] = useState<SetInfo[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // setup state
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set())
  const [wordCountInput, setWordCountInput] = useState('')
  const [direction, setDirection] = useState<Direction>('def-to-word')

  // non-null when session is active
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

  const maxCount = selectedWords.length
  const parsedCount = parseInt(wordCountInput)
  const isCountAll = wordCountInput === '' || isNaN(parsedCount)
  const effectiveCount = isCountAll ? maxCount : Math.min(Math.max(parsedCount, MIN_WORDS), maxCount)

  const handleStart = () => {
    if (selectedSetIds.size === 0 || maxCount < MIN_WORDS) return
    const sampled = isCountAll ? shuffle(selectedWords) : shuffle(selectedWords).slice(0, effectiveCount)
    setSessionWords(sampled)
  }

  if (loading) return (
    <Layout>
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    </Layout>
  )

  if (error || !sets) return (
    <Layout>
      <div className="mx-auto max-w-md py-12 text-center">
        <p className="mb-4 text-gray-500">{error || t('test.loadError')}</p>
        <Link to="/dashboard" className="text-sm text-indigo-600 hover:underline">← {t('test.home')}</Link>
      </div>
    </Layout>
  )

  if (sessionWords) {
    return (
      <Layout>
        <TestRunner
          words={sessionWords}
          backLabel={t('test.backToSetup')}
          skipSettings
          defaultDirection={direction}
          onBack={() => setSessionWords(null)}
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

        <h2 className="mb-6 text-2xl font-bold text-gray-900">{t('test.allTitle')}</h2>

        {/* Set selection */}
        <div className="mb-5 rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">{t('test.selectSets')}</p>
            <button
              onClick={() =>
                setSelectedSetIds(
                  allSelected ? new Set() : new Set(sets.map((s) => s.setId)),
                )
              }
              className="text-xs text-indigo-600 hover:underline"
            >
              {allSelected ? t('test.deselectAll') : t('test.selectAll')}
            </button>
          </div>
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {sets.map((s) => (
              <label
                key={s.setId}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedSetIds.has(s.setId)}
                  onChange={() => toggleSet(s.setId)}
                  className="h-4 w-4 rounded border-gray-300 accent-indigo-600"
                />
                <span className="flex-1 text-sm text-gray-800">{s.setTitle}</span>
                <span className="text-xs text-gray-400">{s.words.length} {wl(s.words.length)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Word count */}
        <div className="mb-5 rounded-xl border bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-medium text-gray-700">{t('test.wordCountLabel')}</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={MIN_WORDS}
              max={maxCount}
              value={wordCountInput}
              onChange={(e) => setWordCountInput(e.target.value)}
              placeholder={String(maxCount)}
              className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={() => setWordCountInput('')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              {t('test.wordCountAll')}
            </button>
            <span className="text-sm text-gray-400">/ {maxCount} {wl(maxCount)}</span>
          </div>
        </div>

        {/* Direction */}
        <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-medium text-gray-700">{t('test.direction')}</p>
          <div className="flex gap-2">
            {(['def-to-word', 'word-to-def'] as Direction[]).map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                  direction === d
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {d === 'word-to-def' ? t('test.wordToDef') : t('test.defToWord')}
              </button>
            ))}
          </div>
        </div>

        {selectedSetIds.size === 0 && (
          <p className="mb-4 text-sm text-red-500">{t('test.noSetsSelected')}</p>
        )}

        <button
          onClick={handleStart}
          disabled={selectedSetIds.size === 0 || maxCount < MIN_WORDS}
          className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {t('test.startBtn')} ({effectiveCount} {wl(effectiveCount)})
        </button>
      </div>
    </Layout>
  )
}

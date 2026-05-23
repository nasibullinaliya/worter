import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAllWords, getWeakestWords, recordWordProgress } from '../api/progress'
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

type StudyMode = 'all' | 'weakest'

export default function TestAll() {
  const { t, wl } = useLang()

  const [sets, setSets] = useState<SetInfo[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set())
  const [direction, setDirection] = useState<Direction>('def-to-word')
  const [studyMode, setStudyMode] = useState<StudyMode>('all')
  const [wordCount, setWordCount] = useState(10)

  const [sessionWords, setSessionWords] = useState<TestWord[] | null>(null)
  const [starting, setStarting] = useState(false)

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

  // Cap wordCount to total available words whenever selection changes
  const maxWords = selectedWords.length
  useEffect(() => {
    if (maxWords > 0) {
      setWordCount((prev) => Math.min(prev, maxWords))
    }
  }, [maxWords])

  const handleStart = async () => {
    if (selectedSetIds.size === 0) return
    setStarting(true)
    try {
      if (studyMode === 'weakest') {
        const items = await getWeakestWords([...selectedSetIds], wordCount)
        if (items.length < MIN_WORDS) return
        const words: TestWord[] = items.map((i) => ({
          wordId: i.wordId,
          setId: i.setId,
          term: i.term,
          definition: i.definition,
        }))
        setSessionWords(words) // keep backend ranking order — weakest first
      } else {
        if (selectedWords.length < MIN_WORDS) return
        setSessionWords(shuffle(selectedWords))
      }
    } catch {
      setError(t('test.loadError'))
    } finally {
      setStarting(false)
    }
  }

  const handleFinish = async (wordResults: { wordId: string; errorCount: number }[]) => {
    try {
      await recordWordProgress(wordResults)
    } catch { /* ignore */ }
    return null
  }

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
        <TestRunner
          words={sessionWords}
          backLabel={t('test.backToSetup')}
          skipSettings
          defaultDirection={direction}
          onBack={() => setSessionWords(null)}
          onFinish={handleFinish}
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

  const canStart = selectedSetIds.size > 0 &&
    (studyMode === 'all' ? selectedWords.length >= MIN_WORDS : wordCount >= MIN_WORDS)

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

        {/* Study mode */}
        <div className="mb-5 rounded-xl border bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-medium text-gray-700">{t('test.wordCountLabel')}</p>
          <div className="flex gap-2">
            {(['all', 'weakest'] as StudyMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setStudyMode(m)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                  studyMode === m
                    ? 'border-violet-600 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {m === 'all' ? t('test.modeAll') : t('test.modeWeakest')}
              </button>
            ))}
          </div>

          {studyMode === 'weakest' && (
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm text-gray-600">{t('test.wordCount')}</label>
                {maxWords > 0 && (
                  <span className="text-xs text-gray-400">{t('test.wordCountMax')} {maxWords}</span>
                )}
              </div>
              <input
                  spellCheck={false}
                type="number"
                min={2}
                max={maxWords || 500}
                value={wordCount}
                onChange={(e) => {
                  const val = Number(e.target.value) || 2
                  setWordCount(Math.max(2, Math.min(maxWords || 500, val)))
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100"
              />
            </div>
          )}
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
                    ? 'border-violet-600 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
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
          disabled={!canStart || starting}
          className="w-full rounded-lg bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {starting
            ? t('test.weakestLoading')
            : studyMode === 'all'
            ? `${t('test.startBtn')} (${selectedWords.length} ${wl(selectedWords.length)})`
            : `${t('test.startBtn')} (${wordCount} ${wl(wordCount)})`}
        </button>
      </div>
    </Layout>
  )
}

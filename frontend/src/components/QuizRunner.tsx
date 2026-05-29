import { useState } from 'react'
import { TestRunner } from './TestRunner'
import { useLang } from '../context/LangContext'
import {
  checkAnswer,
  getAnswer,
  getChoices,
  getQuestion,
  type Direction,
  type TestWord,
} from '../utils/testEngine'

type QuizMode = 'type' | 'choice'
type Screen = 'banner' | 'setup' | 'running' | 'results' | 'completed' | 'failed'

interface FinishResult {
  reviewStage?: number
  isFinalStageFailed?: boolean
}

interface Props {
  words: TestWord[]
  backLabel?: string
  onBack: () => void
  /** When true, skip the setup screen and go straight to running (uses defaultMode / defaultDirection) */
  skipSettings?: boolean
  defaultMode?: QuizMode
  defaultDirection?: Direction
  /** Called once when the quiz results are shown for the first time (non-final stage) */
  onComplete?: (knownWordIds: string[], unknownWordIds: string[]) => void
  /** Final stage: async handler that records the session and returns the result */
  isFinalStage?: boolean
  onFinalFinish?: (knownWordIds: string[], unknownWordIds: string[]) => Promise<FinishResult | null>
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

export function QuizRunner({
  words,
  backLabel,
  onBack,
  skipSettings = false,
  defaultMode = 'type',
  defaultDirection = 'def-to-word',
  onComplete,
  isFinalStage = false,
  onFinalFinish,
}: Props) {
  const { t, wl } = useLang()

  const initialScreen: Screen = isFinalStage ? 'banner' : (skipSettings ? 'running' : 'setup')

  const [screen, setScreen] = useState<Screen>(initialScreen)
  const [mode, setMode] = useState<QuizMode>(isFinalStage ? 'type' : defaultMode)
  const [direction, setDirection] = useState<Direction>(isFinalStage ? 'def-to-word' : defaultDirection)

  const [quizWords, setQuizWords] = useState<TestWord[]>(() =>
    (skipSettings || isFinalStage) ? shuffle(words) : [],
  )
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>({})
  const [choices, setChoices] = useState<Record<string, string[]>>({})
  const [submitting, setSubmitting] = useState(false)

  // when true, show TestRunner for mistake words instead of quiz
  const [studyingMistakes, setStudyingMistakes] = useState(false)

  const initChoices = (shuffled: TestWord[], dir: Direction): Record<string, string[]> => {
    const c: Record<string, string[]> = {}
    for (const w of shuffled) {
      c[w.wordId] = getChoices(w, words, dir)
    }
    return c
  }

  const handleStart = () => {
    const shuffled = shuffle(words)
    setQuizWords(shuffled)
    setAnswers({})
    setSelectedChoices({})
    if (mode === 'choice') {
      setChoices(initChoices(shuffled, direction))
    }
    setScreen('running')
  }

  const [completedFired, setCompletedFired] = useState(false)

  const handleCheck = async () => {
    const knownIds = quizWords
      .filter((w) => {
        const ans = mode === 'type' ? (answers[w.wordId] ?? '') : (selectedChoices[w.wordId] ?? '')
        return checkAnswer(ans, getAnswer(w, direction))
      })
      .map((w) => w.wordId)
    const unknownIds = quizWords.filter((w) => !knownIds.includes(w.wordId)).map((w) => w.wordId)

    if (isFinalStage && onFinalFinish) {
      setSubmitting(true)
      try {
        const result = await onFinalFinish(knownIds, unknownIds)
        setScreen(result?.reviewStage === 6 ? 'completed' : 'failed')
      } finally {
        setSubmitting(false)
      }
      return
    }

    // Regular test
    setScreen('results')
    if (onComplete && !completedFired) {
      onComplete(knownIds, unknownIds)
      setCompletedFired(true)
    }
  }

  const handleRetake = () => {
    const shuffled = shuffle(words)
    setQuizWords(shuffled)
    setAnswers({})
    setSelectedChoices({})
    setCompletedFired(false)
    if (mode === 'choice') {
      setChoices(initChoices(shuffled, direction))
    }
    if (isFinalStage) {
      setScreen('banner')
    } else {
      setScreen('running')
    }
  }

  const results = quizWords.map((w) => {
    const userAnswer =
      mode === 'type' ? (answers[w.wordId] ?? '') : (selectedChoices[w.wordId] ?? '')
    const correct = checkAnswer(userAnswer, getAnswer(w, direction))
    return { word: w, userAnswer, correct }
  })

  const correctCount = results.filter((r) => r.correct).length
  const wrongWords = results.filter((r) => !r.correct).map((r) => r.word)

  // — Study mistakes mode —
  if (studyingMistakes && wrongWords.length > 0) {
    return (
      <TestRunner
        words={wrongWords}
        backLabel={t('quiz.backToResults')}
        skipSettings
        defaultDirection={direction}
        onBack={() => setStudyingMistakes(false)}
      />
    )
  }

  // ── Final stage banner ────────────────────────────────────────────────────────
  if (screen === 'banner') {
    return (
      <div className="mx-auto max-w-md py-10">
        <div className="mb-6">
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">
            {backLabel ?? '←'}
          </button>
        </div>
        <div className="mb-8 rounded-2xl border border-violet-200 bg-violet-50 p-6 text-center">
          <div className="mb-4 flex justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-100">
              <svg className="h-7 w-7 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </span>
          </div>
          <h2 className="mb-2 text-xl font-bold text-violet-900">{t('test.finalStageTitle')}</h2>
          <p className="text-sm text-violet-700 leading-relaxed">{t('test.finalStageHint')}</p>
        </div>
        <button
          onClick={handleStart}
          className="w-full rounded-lg bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          {t('quiz.startBtn')} ({words.length} {wl(words.length)})
        </button>
      </div>
    )
  }

  // ── Set completed! ────────────────────────────────────────────────────────────
  if (screen === 'completed') {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <div className="mb-6 flex justify-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </span>
        </div>
        <h2 className="mb-2 text-2xl font-bold text-gray-900">{t('test.setCompleted')}</h2>
        <p className="mb-8 text-gray-500">{t('test.setCompletedHint')}</p>
        <button
          onClick={onBack}
          className="rounded-lg bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          {backLabel ?? '←'}
        </button>
      </div>
    )
  }

  // ── Final stage failed ────────────────────────────────────────────────────────
  if (screen === 'failed') {
    const wrongResults = results.filter((r) => !r.correct)
    return (
      <div className="mx-auto max-w-2xl py-10">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mb-4 flex justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
          </div>
          <h2 className="mb-1 text-2xl font-bold text-gray-900">{t('test.finalStageFailed')}</h2>
          <p className="text-gray-500">
            {t('test.correctlyWritten')}{' '}
            <strong className="text-amber-600">{correctCount}</strong> {t('common.outOf')}{' '}
            {quizWords.length}
          </p>
        </div>

        {/* Mistakes table */}
        <div className="mb-6 overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="grid grid-cols-[1fr_1fr_24px] border-b bg-gray-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <span>{t('test.definition')}</span>
            <span>{t('quiz.yourAnswer')}</span>
            <span />
          </div>
          {wrongResults.map(({ word, userAnswer }, i) => {
            const question = getQuestion(word, direction)
            const correctAnswer = getAnswer(word, direction)
            const isLast = i === wrongResults.length - 1
            return (
              <div
                key={word.wordId}
                className={`grid grid-cols-[1fr_1fr_24px] gap-4 px-5 py-3 bg-red-50 ${!isLast ? 'border-b' : ''}`}
              >
                <span className="self-start text-sm text-gray-800">{question}</span>
                <div className="self-start">
                  <span className="block text-sm font-medium text-red-600 line-through">
                    {userAnswer || <span className="italic text-gray-400">—</span>}
                  </span>
                  <span className="block text-sm text-gray-700">{correctAnswer}</span>
                </div>
                <span className="self-start text-base text-red-500">✗</span>
              </div>
            )
          })}
        </div>

        {/* Hint + retry */}
        <p className="mb-6 text-center text-sm text-amber-700 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          {t('test.finalStageFailedHint')}
        </p>
        <button
          onClick={handleRetake}
          className="w-full rounded-lg bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          {t('test.retake')}
        </button>
      </div>
    )
  }

  // ── Setup screen ──────────────────────────────────────────────────────────────
  if (screen === 'setup') {
    return (
      <div className="mx-auto max-w-md py-10">
        <button onClick={onBack} className="mb-6 text-sm text-gray-500 hover:text-gray-700">
          {backLabel ?? '←'}
        </button>
        <h2 className="mb-6 text-2xl font-bold text-gray-900">{t('quiz.title')}</h2>

        {/* Mode */}
        <div className="mb-5 rounded-xl border bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-medium text-gray-700">{t('quiz.mode')}</p>
          <div className="flex gap-2">
            {(['type', 'choice'] as QuizMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                  mode === m
                    ? 'border-violet-600 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {m === 'type' ? t('quiz.modeType') : t('quiz.modeChoice')}
              </button>
            ))}
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
                    ? 'border-violet-600 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {d === 'word-to-def' ? t('test.wordToDef') : t('test.defToWord')}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={words.length < 1}
          className="w-full rounded-lg bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {t('quiz.startBtn')} ({words.length} {wl(words.length)})
        </button>
      </div>
    )
  }

  // ── Running screen ────────────────────────────────────────────────────────────
  if (screen === 'running') {
    const allAnswered =
      mode === 'type'
        ? quizWords.every((w) => (answers[w.wordId] ?? '').trim() !== '')
        : quizWords.every((w) => selectedChoices[w.wordId] !== undefined)

    return (
      <div className="mx-auto max-w-2xl py-6">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => isFinalStage ? setScreen('banner') : (skipSettings ? onBack() : setScreen('setup'))}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            {isFinalStage || skipSettings ? (backLabel ?? '←') : `← ${t('test.settingsTitle')}`}
          </button>
          <span className="text-sm text-gray-500">
            {quizWords.length} {wl(quizWords.length)}
          </span>
        </div>

        <div className="mb-4 overflow-hidden rounded-xl border bg-white shadow-sm">
          {/* Table header */}
          <div className="grid grid-cols-2 border-b bg-gray-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <span>
              {direction === 'def-to-word' ? t('test.definition') : t('test.term')}
            </span>
            <span>{t('quiz.yourAnswer')}</span>
          </div>

          {quizWords.map((word, i) => {
            const question = getQuestion(word, direction)
            const isLast = i === quizWords.length - 1
            return (
              <div
                key={word.wordId}
                className={`grid grid-cols-2 gap-4 px-5 py-3 ${!isLast ? 'border-b' : ''}`}
              >
                <span className="self-center text-sm text-gray-800">{question}</span>

                {mode === 'type' ? (
                  <input
                    spellCheck={false}
                    value={answers[word.wordId] ?? ''}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [word.wordId]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && isLast) handleCheck()
                    }}
                    placeholder={t('test.placeholder')}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100"
                  />
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {(choices[word.wordId] ?? []).map((choice) => (
                      <button
                        key={choice}
                        onClick={() =>
                          setSelectedChoices((prev) => ({ ...prev, [word.wordId]: choice }))
                        }
                        className={`rounded-lg border px-3 py-1.5 text-left text-sm font-medium transition-colors ${
                          selectedChoices[word.wordId] === choice
                            ? 'border-violet-600 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button
          onClick={handleCheck}
          disabled={!allAnswered || submitting}
          className="w-full rounded-lg bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {submitting ? '...' : t('quiz.checkBtn')}
        </button>
        {!allAnswered && (
          <p className="mt-2 text-center text-xs text-gray-400">
            {mode === 'type' ? t('test.placeholder') : ''}
          </p>
        )}
      </div>
    )
  }

  // ── Results screen (regular test only) ───────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => (skipSettings ? onBack() : setScreen('setup'))}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          {skipSettings ? (backLabel ?? '←') : `← ${t('test.settingsTitle')}`}
        </button>
        <span className="text-sm font-medium text-gray-700">
          {t('quiz.score')} {correctCount}/{quizWords.length}
        </span>
      </div>

      <h3 className="mb-4 text-lg font-semibold text-gray-900">{t('quiz.results')}</h3>

      {wrongWords.length === 0 && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-medium text-green-700">
          {t('quiz.noMistakes')}
        </div>
      )}

      <div className="mb-6 overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="grid grid-cols-[1fr_1fr_24px] border-b bg-gray-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>
            {direction === 'def-to-word' ? t('test.definition') : t('test.term')}
          </span>
          <span>{t('quiz.yourAnswer')}</span>
          <span />
        </div>

        {results.map(({ word, userAnswer, correct }, i) => {
          const question = getQuestion(word, direction)
          const correctAnswer = getAnswer(word, direction)
          const isLast = i === results.length - 1
          return (
            <div
              key={word.wordId}
              className={`grid grid-cols-[1fr_1fr_24px] gap-4 px-5 py-3 ${
                !isLast ? 'border-b' : ''
              } ${correct ? 'bg-white' : 'bg-red-50'}`}
            >
              <span className="self-start text-sm text-gray-800">{question}</span>
              <div className="self-start">
                <span
                  className={`block text-sm font-medium ${
                    correct ? 'text-green-700' : 'text-red-600 line-through'
                  }`}
                >
                  {userAnswer || <span className="italic text-gray-400">—</span>}
                </span>
                {!correct && (
                  <span className="block text-sm text-gray-700">{correctAnswer}</span>
                )}
              </div>
              <span className="self-start text-base">
                {correct ? (
                  <span className="text-green-500">✓</span>
                ) : (
                  <span className="text-red-500">✗</span>
                )}
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3">
        {wrongWords.length > 0 && (
          <button
            onClick={() => setStudyingMistakes(true)}
            className="flex-1 rounded-lg bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            {t('quiz.studyMistakes')} ({wrongWords.length})
          </button>
        )}
        <button
          onClick={handleRetake}
          className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {t('quiz.retake')}
        </button>
      </div>
    </div>
  )
}

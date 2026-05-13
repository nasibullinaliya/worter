import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProgressBar } from './ProgressBar'
import { useLang } from '../context/LangContext'
import {
  type Direction,
  type QueueItem,
  type TestWord,
  buildInitialQueue,
  checkAnswer,
  diffInput,
  getAnswer,
  getChoices,
  getHint,
  getQuestion,
} from '../utils/testEngine'

interface FinishResult {
  nextReviewAt: string | null
}

interface Props {
  words: TestWord[]
  backHref?: string
  backLabel: string
  onFinish?: (knownWordIds: string[]) => Promise<FinishResult | null>
  defaultDirection?: Direction
  skipSettings?: boolean
  onBack?: () => void
}

type Screen = 'settings' | 'running' | 'done'

export function TestRunner({ words, backHref, backLabel, onFinish, defaultDirection, skipSettings, onBack }: Props) {
  const { t, wl, dateLocale } = useLang()

  const [screen, setScreen] = useState<Screen>(() => skipSettings ? 'running' : 'settings')
  const [direction, setDirection] = useState<Direction>(defaultDirection ?? 'def-to-word')

  // running state
  const [queue, setQueue] = useState<QueueItem[]>(() => skipSettings ? buildInitialQueue(words) : [])
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [choicePassedIds, setChoicePassedIds] = useState<Set<string>>(new Set())

  // choices stored in state so keyboard handler has stable reference
  const [currentChoices, setCurrentChoices] = useState<string[]>([])

  // per-item state — reset on each advance
  const [choiceSelected, setChoiceSelected] = useState<string | null>(null)
  const [typeInput, setTypeInput] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [typeFeedback, setTypeFeedback] = useState<'idle' | 'wrong'>('idle')
  const [wrongAnswer, setWrongAnswer] = useState('')

  // manual-advance: after a wrong answer the user clicks "Далее" instead of auto-skip
  const [waitForNext, setWaitForNext] = useState(false)
  const [pendingRequeue, setPendingRequeue] = useState<QueueItem[]>([])

  const [finishResult, setFinishResult] = useState<FinishResult | null | undefined>(undefined)

  const inputRef = useRef<HTMLInputElement>(null)
  const wordMap = Object.fromEntries(words.map((w) => [w.wordId, w]))
  const total = words.length

  const resetItemState = () => {
    setChoiceSelected(null)
    setTypeInput('')
    setShowHint(false)
    setTypeFeedback('idle')
    setWrongAnswer('')
    setWaitForNext(false)
    setPendingRequeue([])
  }

  const start = () => {
    setQueue(buildInitialQueue(words))
    setDoneIds(new Set())
    setChoicePassedIds(new Set())
    setFinishResult(undefined)
    resetItemState()
    setScreen('running')
  }

  const current = queue[0] ?? null
  const currentWord = current ? wordMap[current.wordId] : null

  // Recompute choices when current choice-phase item changes
  useEffect(() => {
    if (current?.phase === 'choice' && currentWord) {
      setCurrentChoices(getChoices(currentWord, words, direction))
    }
  }, [current?.wordId, current?.phase])

  // Focus input when entering type phase
  useEffect(() => {
    if (current?.phase === 'type' && typeFeedback === 'idle' && !waitForNext) {
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [current?.wordId, current?.phase, typeFeedback, waitForNext])

  // Keyboard shortcuts: 1–4 select choices
  useEffect(() => {
    if (screen !== 'running' || current?.phase !== 'choice' || choiceSelected !== null || waitForNext) return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const n = parseInt(e.key)
      if (!isNaN(n) && n >= 1 && n <= currentChoices.length) {
        handleChoiceSelect(currentChoices[n - 1])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [screen, current?.phase, choiceSelected, waitForNext, currentChoices])

  const advance = (requeue: QueueItem[], completedWordId?: string) => {
    const [, ...rest] = queue
    const nextDoneIds = completedWordId
      ? new Set([...doneIds, completedWordId])
      : doneIds
    const nextQueue = [...rest, ...requeue]

    resetItemState()

    if (nextQueue.length === 0) {
      setDoneIds(nextDoneIds)
      setQueue([])
      setScreen('done')
      const knownIds = [...nextDoneIds]
      if (onFinish) {
        onFinish(knownIds)
          .then((res) => setFinishResult(res))
          .catch(() => setFinishResult(null))
      }
    } else {
      setDoneIds(nextDoneIds)
      setQueue(nextQueue)
    }
  }

  const handleChoiceSelect = (choice: string) => {
    if (choiceSelected !== null || !currentWord || waitForNext) return
    setChoiceSelected(choice)
    const correct = getAnswer(currentWord, direction)

    if (choice === correct) {
      // Correct → record choice pass, auto-advance after 900ms, queue type phase
      setChoicePassedIds((prev) => new Set([...prev, current.wordId]))
      setTimeout(() => advance([{ wordId: current.wordId, phase: 'type' }]), 900)
    } else {
      // Wrong → wait for manual "Next"
      setWaitForNext(true)
      setPendingRequeue([{ wordId: current.wordId, phase: 'choice' }])
    }
  }

  const handleTypeSubmit = () => {
    if (!currentWord || typeFeedback === 'wrong' || waitForNext) return
    const correct = getAnswer(currentWord, direction)
    if (checkAnswer(typeInput, correct)) {
      advance([], current.wordId)
    } else {
      setWrongAnswer(correct)
      setTypeFeedback('wrong')
      setWaitForNext(true)
      setPendingRequeue([{ wordId: current.wordId, phase: 'type' }])
    }
  }

  const handleNext = () => {
    advance(pendingRequeue)
  }

  const BackLink = ({ className }: { className?: string }) =>
    onBack ? (
      <button onClick={onBack} className={className}>← {backLabel}</button>
    ) : backHref ? (
      <Link to={backHref} className={className}>← {backLabel}</Link>
    ) : null

  // ── Settings screen ──────────────────────────────────────────────────────────
  if (screen === 'settings') {
    return (
      <div className="mx-auto max-w-md py-10">
        <div className="mb-6">
          <BackLink className="text-sm text-gray-500 hover:text-gray-700" />
        </div>

        <h2 className="mb-6 text-2xl font-bold text-gray-900">{t('test.settingsTitle')}</h2>

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

        <p className="mb-6 text-sm text-gray-500">{t('test.description')}</p>

        <button
          onClick={start}
          className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {t('test.startBtn')} ({total} {wl(total)})
        </button>
      </div>
    )
  }

  // ── Done screen ──────────────────────────────────────────────────────────────
  if (screen === 'done') {
    const score = doneIds.size
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <div className="mb-6 text-5xl">{score === total ? '🏆' : score >= total / 2 ? '👍' : '📖'}</div>
        <h2 className="mb-2 text-2xl font-bold text-gray-900">{t('test.done')}</h2>
        <p className="mb-6 text-gray-500">
          {t('test.correctlyWritten')}{' '}
          <strong className="text-indigo-600">{score}</strong> {t('common.outOf')} {total}
        </p>
        <ProgressBar known={score} total={total} className="mb-8" />

        {finishResult !== undefined && finishResult !== null && (
          <p className="mb-6 text-sm text-gray-400">
            {t('common.nextReview')}{' '}
            {finishResult.nextReviewAt
              ? new Date(finishResult.nextReviewAt).toLocaleDateString(dateLocale)
              : t('common.courseDone')}
          </p>
        )}

        <div className="flex justify-center gap-3">
          <button
            onClick={start}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {t('test.retake')}
          </button>
          {onBack ? (
            <button
              onClick={onBack}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {backLabel}
            </button>
          ) : backHref ? (
            <Link
              to={backHref}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {backLabel}
            </Link>
          ) : null}
        </div>
      </div>
    )
  }

  // ── Running screen ───────────────────────────────────────────────────────────
  if (!currentWord) return null

  const questionText = getQuestion(currentWord, direction)
  const answerText = getAnswer(currentWord, direction)
  const hint = getHint(answerText)

  return (
    <div className="mx-auto max-w-lg">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <BackLink className="text-sm text-gray-500 hover:text-gray-700" />
        <div className="text-right">
          <span className="text-sm text-gray-500">
            {doneIds.size} / {total}
          </span>
          <span className="ml-3 text-xs text-gray-400">
            ({queue.length} {t('test.inQueue')})
          </span>
        </div>
      </div>

      {/* Progress bar covers both phases: each word = 2 steps */}
      <ProgressBar known={choicePassedIds.size + doneIds.size} total={total * 2} className="mb-6" />

      {/* Phase badge */}
      <div className="mb-3 flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          current.phase === 'choice'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-violet-100 text-violet-700'
        }`}>
          {current.phase === 'choice' ? t('test.choicePhase') : t('test.typePhase')}
        </span>
      </div>

      {/* Question card */}
      <div className="mb-6 rounded-2xl border bg-white p-8 text-center shadow-md">
        <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">
          {direction === 'word-to-def' ? t('test.questionMeaning') : t('test.questionTranslate')}
        </p>
        <p className="text-3xl font-bold text-gray-900">{questionText}</p>
      </div>

      {/* Choice phase */}
      {current.phase === 'choice' && (
        <div className="grid gap-3">
          {currentChoices.map((choice, idx) => {
            const isCorrect = choice === answerText
            const isSelected = choice === choiceSelected

            let style = 'border-gray-200 text-gray-800 hover:border-indigo-400 hover:bg-indigo-50'
            if (choiceSelected !== null) {
              if (isCorrect) style = 'border-green-400 bg-green-50 text-green-800'
              else if (isSelected) style = 'border-red-400 bg-red-50 text-red-800'
              else style = 'border-gray-200 text-gray-400'
            }

            return (
              <button
                key={choice}
                onClick={() => handleChoiceSelect(choice)}
                disabled={choiceSelected !== null}
                className={`rounded-xl border-2 px-5 py-3 text-left text-sm font-medium transition-colors ${style}`}
              >
                <span className="mr-3 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-xs opacity-60">
                  {idx + 1}
                </span>
                {choice}
              </button>
            )
          })}

          {/* Keyboard hint */}
          {!choiceSelected && (
            <p className="mt-1 text-center text-xs text-gray-400">
              {t('test.keyboardHint').replace('{n}', String(currentChoices.length))}
            </p>
          )}

          {/* Manual-advance button after wrong choice */}
          {waitForNext && (
            <button
              onClick={handleNext}
              className="mt-2 w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {t('test.next')}
            </button>
          )}
        </div>
      )}

      {/* Type phase */}
      {current.phase === 'type' && (
        <div>
          {waitForNext ? (
            <>
              {/* Correct answer — green */}
              <div className="mb-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-green-600">
                  {t('test.correctAnswer')}
                </p>
                <p className="font-mono text-lg text-green-800">{wrongAnswer}</p>
              </div>

              {/* User's answer — wrong/missing chars red, no fill */}
              <div className="mb-4 rounded-xl border border-red-200 px-4 py-3 font-mono text-lg">
                {diffInput(typeInput, wrongAnswer).map((d, idx) =>
                  d.status === 'ok'
                    ? <span key={idx} className="text-gray-700">{d.char}</span>
                    : <span key={idx} className="font-bold text-red-600 underline decoration-2">{d.char === '_' ? '_' : d.char}</span>
                )}
              </div>

              <button
                onClick={handleNext}
                className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                {t('test.next')}
              </button>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={typeInput}
                  onChange={(e) => setTypeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTypeSubmit()}
                  placeholder={t('test.placeholder')}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={handleTypeSubmit}
                  disabled={typeInput.trim() === ''}
                  className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  {t('test.ok')}
                </button>
              </div>

              {!showHint ? (
                <button
                  onClick={() => setShowHint(true)}
                  className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  {t('test.showHint')}
                </button>
              ) : (
                <p className="mt-3 font-mono text-sm text-indigo-500">{hint}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

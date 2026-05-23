import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProgressBar } from './ProgressBar'
import { SpeakButton } from './SpeakButton'
import { useLang } from '../context/LangContext'
import {
  type Direction,
  type QueueItem,
  type TestWord,
  buildStageQueue,
  checkAnswer,
  chunkWords,
  diffInput,
  getAnswer,
  getChoices,
  getHint,
  getQuestion,
  STAGE_SIZE,
} from '../utils/testEngine'

interface FinishResult {
  nextReviewAt: string | null
}

interface Props {
  words: TestWord[]
  backHref?: string
  backLabel: string
  onFinish?: (wordResults: { wordId: string; errorCount: number }[]) => Promise<FinishResult | null>
  defaultDirection?: Direction
  skipSettings?: boolean
  onBack?: () => void
  lang?: string
}

type Screen = 'settings' | 'running' | 'stage-review' | 'done'

export function TestRunner({
  words,
  backHref,
  backLabel,
  onFinish,
  defaultDirection,
  skipSettings,
  onBack,
  lang,
}: Props) {
  const { t, wl, dateLocale } = useLang()

  const [screen, setScreen] = useState<Screen>(() =>
    skipSettings ? 'running' : 'settings',
  )
  const [direction, setDirection] = useState<Direction>(
    defaultDirection ?? 'def-to-word',
  )

  // ── Stage management ──────────────────────────────────────────────────────────
  const [stages] = useState<TestWord[][]>(() => chunkWords(words, STAGE_SIZE))
  const [stageIndex, setStageIndex] = useState(0)
  // All words shown in the current stage (new + carry-overs) — used for review screen
  const [stageWords, setStageWords] = useState<TestWord[]>([])
  // Items to bring into the next stage
  const [nextCarryOvers, setNextCarryOvers] = useState<QueueItem[]>([])

  // ── Queue (current stage) ─────────────────────────────────────────────────────
  const [queue, setQueue] = useState<QueueItem[]>([])

  // ── Global completion tracking ────────────────────────────────────────────────
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  // error count per word during this session
  const [errorCounts, setErrorCounts] = useState<Map<string, number>>(new Map())
  // words that passed choice phase (contributes ½ progress step)
  const [choicePassedIds, setChoicePassedIds] = useState<Set<string>>(new Set())

  // ── Per-item UI state — reset on each advance ─────────────────────────────────
  const [currentChoices, setCurrentChoices] = useState<string[]>([])
  const [choiceSelected, setChoiceSelected] = useState<string | null>(null)
  const [typeInput, setTypeInput] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [typeFeedback, setTypeFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle')
  const [wrongAnswer, setWrongAnswer] = useState('')
  // After a wrong answer the user must click "Next" manually
  const [waitForNext, setWaitForNext] = useState(false)
  // Which item to carry forward when the user clicks "Next"
  const [pendingCarry, setPendingCarry] = useState<QueueItem | null>(null)

  const [finishResult, setFinishResult] = useState<FinishResult | null | undefined>(
    undefined,
  )

  const inputRef = useRef<HTMLInputElement>(null)
  const wordMap = Object.fromEntries(words.map((w) => [w.wordId, w]))
  const total = words.length

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const resetItemState = () => {
    setChoiceSelected(null)
    setTypeInput('')
    setShowHint(false)
    setTypeFeedback('idle')
    setWrongAnswer('')
    setWaitForNext(false)
    setPendingCarry(null)
  }

  /** Build the queue + stageWords for a given stage and its incoming carry-overs. */
  const initStage = (idx: number, carryOvers: QueueItem[]) => {
    const batch = stages[idx] ?? []
    const carryWords = carryOvers.map((c) => wordMap[c.wordId]).filter(Boolean) as TestWord[]
    const allStageWords = [...carryWords, ...batch]
    setStageIndex(idx)
    setStageWords(allStageWords)
    setNextCarryOvers([])
    setQueue(buildStageQueue(carryOvers, batch))
    resetItemState()
  }

  const start = () => {
    setDoneIds(new Set())
    setChoicePassedIds(new Set())
    setFinishResult(undefined)
    initStage(0, [])
    setScreen('running')
  }

  // Auto-start when skipSettings
  useEffect(() => {
    if (skipSettings) start()
  }, [])

  const current = queue[0] ?? null
  const currentWord = current ? wordMap[current.wordId] : null

  // ── Recompute choices when entering a new choice-phase item ───────────────────
  useEffect(() => {
    if (current?.phase === 'choice' && currentWord) {
      setCurrentChoices(getChoices(currentWord, words, direction))
    }
  }, [current?.wordId, current?.phase])

  // ── Focus input when entering type phase ──────────────────────────────────────
  useEffect(() => {
    if (current?.phase === 'type' && typeFeedback === 'idle' && !waitForNext) {
      const id = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(id)
    }
  }, [current?.wordId, current?.phase, typeFeedback, waitForNext])

  // ── Keyboard: 1–4 select choices ──────────────────────────────────────────────
  useEffect(() => {
    if (
      screen !== 'running' ||
      current?.phase !== 'choice' ||
      choiceSelected !== null ||
      waitForNext
    )
      return
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

  // ── Focus "Next" button when wrong answer is shown (choice or type phase) ─────
  const nextAfterWrongRef = useRef<HTMLButtonElement>(null)
  const nextAfterWrongChoiceRef = useRef<HTMLButtonElement>(null)
  const continueStageRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (waitForNext && current?.phase === 'type') {
      const id = setTimeout(() => nextAfterWrongRef.current?.focus(), 50)
      return () => clearTimeout(id)
    }
  }, [waitForNext, current?.phase])

  useEffect(() => {
    if (waitForNext && current?.phase === 'choice') {
      const id = setTimeout(() => nextAfterWrongChoiceRef.current?.focus(), 50)
      return () => clearTimeout(id)
    }
  }, [waitForNext, current?.phase])

  useEffect(() => {
    if (screen === 'stage-review') {
      const id = setTimeout(() => continueStageRef.current?.focus(), 50)
      return () => clearTimeout(id)
    }
  }, [screen])

  // ── Core advance ──────────────────────────────────────────────────────────────
  /**
   * Move to the next item in the queue.
   * @param carryItem  If set, this item will be carried over to the next stage.
   * @param completedWordId  If set, this word is fully done (choice + type correct).
   */
  const advance = (carryItem: QueueItem | null, completedWordId?: string) => {
    const newDoneIds = completedWordId
      ? new Set([...doneIds, completedWordId])
      : doneIds

    const newCarryOvers = carryItem
      ? [...nextCarryOvers, carryItem]
      : [...nextCarryOvers]

    const [, ...restQueue] = queue
    resetItemState()
    setDoneIds(newDoneIds)

    if (restQueue.length === 0) {
      // Stage queue exhausted
      setNextCarryOvers(newCarryOvers)
      setQueue([])

      const nextIdx = stageIndex + 1
      const hasMore = nextIdx < stages.length || newCarryOvers.length > 0

      if (!hasMore) {
        // Session complete — build wordResults with actual error counts
        const wordResults = [...newDoneIds].map((wordId) => ({
          wordId,
          errorCount: errorCounts.get(wordId) ?? 0,
        }))
        setScreen('done')
        if (onFinish) {
          onFinish(wordResults)
            .then(setFinishResult)
            .catch(() => setFinishResult(null))
        }
      } else {
        setScreen('stage-review')
      }
    } else {
      setNextCarryOvers(newCarryOvers)
      setQueue(restQueue)
    }
  }

  // ── Choice phase handlers ─────────────────────────────────────────────────────
  const handleChoiceSelect = (choice: string) => {
    if (choiceSelected !== null || !currentWord || !current || waitForNext) return
    setChoiceSelected(choice)
    const correct = getAnswer(currentWord, direction)

    if (choice === correct) {
      // Correct: track choice pass, carry forward to type phase in the next stage
      setChoicePassedIds((prev) => new Set([...prev, current.wordId]))
      setTimeout(
        () => advance({ wordId: current.wordId, phase: 'type' }),
        900,
      )
    } else {
      // Wrong: increment error count, wait for manual "Next", carry forward as choice again
      setErrorCounts((prev) => new Map(prev).set(current.wordId, (prev.get(current.wordId) ?? 0) + 1))
      setWaitForNext(true)
      setPendingCarry({ wordId: current.wordId, phase: 'choice' })
    }
  }

  // ── Type phase handlers ───────────────────────────────────────────────────────
  const handleTypeSubmit = () => {
    if (!currentWord || !current || typeFeedback !== 'idle' || waitForNext) return
    const correct = getAnswer(currentWord, direction)

    if (checkAnswer(typeInput, correct)) {
      // Correct: flash green, then advance after pause
      setTypeFeedback('correct')
      setTimeout(() => advance(null, current.wordId), 900)
    } else {
      // Wrong: increment error count, wait for manual "Next", carry forward as type again
      setErrorCounts((prev) => new Map(prev).set(current.wordId, (prev.get(current.wordId) ?? 0) + 1))
      setWrongAnswer(correct)
      setTypeFeedback('wrong')
      setWaitForNext(true)
      setPendingCarry({ wordId: current.wordId, phase: 'type' })
    }
  }

  const handleNext = () => advance(pendingCarry)

  // ── Continue to next stage ────────────────────────────────────────────────────
  const continueToNextStage = () => {
    const nextIdx = stageIndex + 1

    if (nextIdx >= stages.length && nextCarryOvers.length === 0) {
      const wordResults = [...doneIds].map((wordId) => ({
        wordId,
        errorCount: errorCounts.get(wordId) ?? 0,
      }))
      setScreen('done')
      if (onFinish) {
        onFinish(wordResults).then(setFinishResult).catch(() => setFinishResult(null))
      }
      return
    }

    initStage(nextIdx, nextCarryOvers)
    setScreen('running')
  }

  // ── BackLink helper ───────────────────────────────────────────────────────────
  const BackLink = ({ className }: { className?: string }) =>
    onBack ? (
      <button onClick={onBack} className={className}>
        ← {backLabel}
      </button>
    ) : backHref ? (
      <Link to={backHref} className={className}>
        ← {backLabel}
      </Link>
    ) : null

  // ─────────────────────────────────────────────────────────────────────────────
  // SETTINGS SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen === 'settings') {
    return (
      <div className="mx-auto max-w-md py-10">
        <div className="mb-6">
          <BackLink className="text-sm text-gray-500 hover:text-gray-700" />
        </div>

        <h2 className="mb-6 text-2xl font-bold text-gray-900">
          {t('study.settingsTitle')}
        </h2>

        <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-medium text-gray-700">
            {t('test.direction')}
          </p>
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

        <p className="mb-6 text-sm text-gray-500">{t('test.description')}</p>

        <button
          onClick={start}
          className="w-full rounded-lg bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          {t('test.startBtn')} ({total} {wl(total)})
        </button>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STAGE REVIEW SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen === 'stage-review') {
    const nextIdx = stageIndex + 1
    const hasMoreStages = nextIdx < stages.length || nextCarryOvers.length > 0

    return (
      <div className="mx-auto max-w-lg py-10">
        {/* Header */}
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm text-gray-400">
            {t('test.stage')} {stageIndex + 1}
          </span>
          <span className="text-sm text-gray-500">
            {doneIds.size} / {total} {wl(total)} {t('test.learned')}
          </span>
        </div>

        {/* Progress bar — same 2-step formula as running screen */}
        <ProgressBar known={choicePassedIds.size + doneIds.size} total={total * 2} className="mb-6" />

        {/* Word list */}
        <div className="mb-6 overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="grid grid-cols-2 border-b bg-gray-50 px-4 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t('test.definition')}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t('test.term')}
            </span>
          </div>
          <div className="divide-y">
            {stageWords.map((word) => (
              <div
                key={word.wordId}
                className="grid grid-cols-2 gap-2 px-4 py-3 text-sm"
              >
                <span className="text-gray-500 leading-snug">{word.definition}</span>
                <span className="font-medium text-gray-900 leading-snug">
                  {word.term}
                  {doneIds.has(word.wordId) && (
                    <span className="ml-1.5 text-xs text-green-500">✓</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          ref={continueStageRef}
          onClick={continueToNextStage}
          onKeyDown={(e) => {
            if (!['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
              e.preventDefault()
              continueToNextStage()
            }
          }}
          className="w-full rounded-lg bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          {hasMoreStages ? t('test.continueNext') : t('test.finish')}
        </button>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DONE SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen === 'done') {
    const score = doneIds.size
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <div className="mb-6 flex justify-center">
          {score === total ? (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          ) : score >= total / 2 ? (
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
        <h2 className="mb-2 text-2xl font-bold text-gray-900">{t('test.done')}</h2>
        <p className="mb-6 text-gray-500">
          {t('test.correctlyWritten')}{' '}
          <strong className="text-violet-600">{score}</strong> {t('common.outOf')}{' '}
          {total}
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
            className="rounded-lg bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
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

  // ─────────────────────────────────────────────────────────────────────────────
  // RUNNING SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (!currentWord || !current) return null

  const questionText = getQuestion(currentWord, direction)
  const answerText = getAnswer(currentWord, direction)
  const hint = getHint(answerText)

  // Progress: each word contributes 2 steps (choice + type)
  const progressDone = choicePassedIds.size + doneIds.size

  return (
    <div className="mx-auto max-w-lg">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <BackLink className="text-sm text-gray-500 hover:text-gray-700" />
        <div className="text-right">
          <span className="text-sm text-gray-500">
            {doneIds.size} / {total}
          </span>
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {t('test.stage')} {stageIndex + 1}
          </span>
          <span className="ml-2 text-xs text-gray-400">
            ({queue.length} {t('test.inQueue')})
          </span>
        </div>
      </div>

      {/* Progress bar — global 2-step progress */}
      <ProgressBar known={progressDone} total={total * 2} className="mb-6" />

      {/* Phase badge */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            current.phase === 'choice'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-violet-100 text-violet-700'
          }`}
        >
          {current.phase === 'choice' ? t('test.choicePhase') : t('test.typePhase')}
        </span>
      </div>

      {/* Question card */}
      <div className="mb-6 rounded-2xl border bg-white p-8 text-center shadow-md">
        <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">
          {direction === 'word-to-def'
            ? t('test.questionMeaning')
            : t('test.questionTranslate')}
        </p>
        <div className="flex items-center justify-center gap-2">
          <p className="text-3xl font-bold text-gray-900">{questionText}</p>
          <SpeakButton text={questionText} lang={direction === 'word-to-def' ? lang : undefined} />
        </div>
      </div>

      {/* ── Choice phase ── */}
      {current.phase === 'choice' && (
        <div className="grid gap-3">
          {currentChoices.map((choice, idx) => {
            const isCorrect = choice === answerText
            const isSelected = choice === choiceSelected

            let style =
              'border-gray-200 text-gray-800 hover:border-violet-400 hover:bg-violet-50'
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

          {!choiceSelected && (
            <p className="mt-1 text-center text-xs text-gray-400">
              {t('test.keyboardHint').replace('{n}', String(currentChoices.length))}
            </p>
          )}

          {waitForNext && (
            <button
              ref={nextAfterWrongChoiceRef}
              onClick={handleNext}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleNext()
                }
              }}
              className="mt-2 w-full rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              {t('test.next')}
            </button>
          )}
        </div>
      )}

      {/* ── Type phase ── */}
      {current.phase === 'type' && (
        <div>
          {waitForNext ? (
            <>
              <div className="mb-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-green-600">
                  {t('test.correctAnswer')}
                </p>
                <p className="font-mono text-lg text-green-800">{wrongAnswer}</p>
              </div>

              <div className="mb-4 rounded-xl border border-red-200 px-4 py-3 font-mono text-lg">
                {diffInput(typeInput, wrongAnswer).map((d, idx) =>
                  d.status === 'ok' ? (
                    <span key={idx} className="text-gray-700">
                      {d.char}
                    </span>
                  ) : (
                    <span
                      key={idx}
                      className="font-bold text-red-600 underline decoration-2"
                    >
                      {d.char === '_' ? '_' : d.char}
                    </span>
                  ),
                )}
              </div>

              <button
                ref={nextAfterWrongRef}
                onClick={handleNext}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleNext()
                  }
                }}
                className="w-full rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                {t('test.next')}
              </button>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                    spellCheck={false}
                  ref={inputRef}
                  type="text"
                  value={typeInput}
                  onChange={(e) => typeFeedback === 'idle' && setTypeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTypeSubmit()}
                  placeholder={t('test.placeholder')}
                  readOnly={typeFeedback === 'correct'}
                  className={`flex-1 rounded-xl border px-4 py-3 text-sm outline-none transition-colors ${
                    typeFeedback === 'correct'
                      ? 'border-green-400 bg-green-50 text-green-800'
                      : 'border-gray-300 focus:border-violet-400 focus:ring-1 focus:ring-violet-100'
                  }`}
                />
                <button
                  onClick={handleTypeSubmit}
                  disabled={typeInput.trim() === '' || typeFeedback !== 'idle'}
                  className={`rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all ${
                    typeFeedback === 'correct'
                      ? 'bg-green-400'
                      : 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:opacity-90 disabled:opacity-40'
                  }`}
                >
                  {t('test.ok')}
                </button>
              </div>

              {!showHint ? (
                <button
                  onClick={() => setShowHint(true)}
                  className="mt-3 text-xs text-gray-400 underline hover:text-gray-600"
                >
                  {t('test.showHint')}
                </button>
              ) : (
                <p className="mt-3 font-mono text-sm text-violet-500">{hint}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export type Direction = 'word-to-def' | 'def-to-word'

export interface TestWord {
  wordId: string
  setId: string
  term: string
  definition: string
}

export interface QueueItem {
  wordId: string
  phase: 'choice' | 'type'
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

export function getQuestion(word: TestWord, direction: Direction): string {
  return direction === 'word-to-def' ? word.term : word.definition
}

export function getAnswer(word: TestWord, direction: Direction): string {
  return direction === 'word-to-def' ? word.definition : word.term
}

export function getChoices(word: TestWord, allWords: TestWord[], direction: Direction): string[] {
  const correct = getAnswer(word, direction)
  const others = allWords.filter((w) => w.wordId !== word.wordId)
  const wrong = shuffle(others)
    .slice(0, Math.min(3, others.length))
    .map((w) => getAnswer(w, direction))
  return shuffle([correct, ...wrong])
}

export function getHint(answer: string): string {
  const shown = answer.length <= 3 ? 1 : 3
  return answer.slice(0, shown) + '_'.repeat(answer.length - shown)
}

export function checkAnswer(input: string, correct: string): boolean {
  const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
  return normalize(input) === normalize(correct)
}

export const STAGE_SIZE = 10

/** Split words into shuffled chunks of STAGE_SIZE. */
export function chunkWords(words: TestWord[], size = STAGE_SIZE): TestWord[][] {
  const shuffled = shuffle(words)
  const chunks: TestWord[][] = []
  for (let i = 0; i < shuffled.length; i += size) {
    chunks.push(shuffled.slice(i, i + size))
  }
  return chunks
}

/**
 * Build the queue for one stage.
 * Carry-overs (items waiting for their next phase) come first, shuffled with new words.
 */
export function buildStageQueue(carryOvers: QueueItem[], newWords: TestWord[]): QueueItem[] {
  const newItems: QueueItem[] = newWords.map((w) => ({ wordId: w.wordId, phase: 'choice' as const }))
  return shuffle([...carryOvers, ...newItems])
}

/** @deprecated Use buildStageQueue instead */
export function buildInitialQueue(words: TestWord[]): QueueItem[] {
  return buildStageQueue([], words)
}

// ── Character-level diff ──────────────────────────────────────────────────────

export type DiffStatus = 'ok' | 'wrong' | 'missing' | 'extra'

export interface DiffChar {
  char: string
  status: DiffStatus
}

/**
 * Diff the user's INPUT against the correct answer using LCS alignment.
 *   'ok'      — char matched correctly
 *   'wrong'   — extra or substituted char (user typed something that doesn't belong)
 *   'missing' — char present in correct but absent in input; rendered as '_'
 */
export function diffInput(input: string, correct: string): DiffChar[] {
  const a = input.trim()
  const b = correct.trim()
  const m = a.length
  const n = b.length

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1].toLowerCase() === b[j - 1].toLowerCase()
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  // If the input matches fewer than half the correct answer's chars, the diff
  // would produce a confusing mix of underscores and red chars. In that case
  // just mark everything the user typed as wrong — no underscores.
  if (n > 0 && dp[m][n] / n < 0.5) {
    return Array.from(a).map((char) => ({ char, status: 'wrong' as DiffStatus }))
  }

  const raw: DiffChar[] = []
  let i = m
  let j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) {
      raw.unshift({ char: a[i - 1], status: 'ok' })
      i--
      j--
    } else if (i > 0 && (j === 0 || dp[i - 1][j] >= dp[i][j - 1])) {
      raw.unshift({ char: a[i - 1], status: 'wrong' })
      i--
    } else {
      raw.unshift({ char: '_', status: 'missing' })
      j--
    }
  }

  // Collapse adjacent missing+wrong or wrong+missing into a single substitution error.
  // LCS encodes "user typed X instead of Y" as two operations; we want one marker.
  const result: DiffChar[] = []
  let k = 0
  while (k < raw.length) {
    const curr = raw[k]
    const next = raw[k + 1]
    if (curr.status === 'missing' && next?.status === 'wrong') {
      result.push({ char: next.char, status: 'wrong' })
      k += 2
    } else if (curr.status === 'wrong' && next?.status === 'missing') {
      result.push({ char: curr.char, status: 'wrong' })
      k += 2
    } else {
      result.push(curr)
      k++
    }
  }
  return result
}

/**
 * Returns a character-by-character diff of `input` against `correct`.
 * The result covers the full correct answer; characters the user typed correctly
 * are 'ok', characters that are wrong or missing are 'wrong', and characters the
 * user typed but that don't appear in the correct answer are 'extra' (appended at
 * the end so the user sees what they added).
 *
 * Algorithm: LCS-based alignment, case-insensitive.
 */
export function diffAnswer(input: string, correct: string): DiffChar[] {
  const a = input.trim()
  const b = correct.trim()
  const m = a.length
  const n = b.length

  // Build LCS DP table (case-insensitive)
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1].toLowerCase() === b[j - 1].toLowerCase()
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  // Backtrack to build alignment
  const result: DiffChar[] = []
  let extraCount = 0
  let i = m
  let j = n

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) {
      // Matched — show the correct-cased char from `b`
      result.unshift({ char: b[j - 1], status: 'ok' })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      // Char in correct but missing from input
      result.unshift({ char: b[j - 1], status: 'wrong' })
      j--
    } else {
      // Extra char in input not present in correct
      extraCount++
      i--
    }
  }

  // Append a marker for each extra character the user typed
  for (let k = 0; k < extraCount; k++) {
    result.push({ char: '+', status: 'extra' })
  }

  return result
}

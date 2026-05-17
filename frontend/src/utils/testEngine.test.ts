import { describe, it, expect } from 'vitest'
import {
  getQuestion,
  getAnswer,
  getChoices,
  getHint,
  checkAnswer,
  buildStageQueue,
  chunkWords,
  diffInput,
  type TestWord,
} from './testEngine'

const word = (id: string, term: string, def: string): TestWord => ({
  wordId: id,
  setId: 'set-1',
  term,
  definition: def,
})

const WORDS: TestWord[] = [
  word('1', 'apple', 'яблоко'),
  word('2', 'banana', 'банан'),
  word('3', 'cherry', 'вишня'),
  word('4', 'date', 'финик'),
]

// ── getQuestion / getAnswer ───────────────────────────────────────────────────

describe('getQuestion', () => {
  it('returns term for word-to-def direction', () => {
    expect(getQuestion(WORDS[0], 'word-to-def')).toBe('apple')
  })
  it('returns definition for def-to-word direction', () => {
    expect(getQuestion(WORDS[0], 'def-to-word')).toBe('яблоко')
  })
})

describe('getAnswer', () => {
  it('returns definition for word-to-def direction', () => {
    expect(getAnswer(WORDS[0], 'word-to-def')).toBe('яблоко')
  })
  it('returns term for def-to-word direction', () => {
    expect(getAnswer(WORDS[0], 'def-to-word')).toBe('apple')
  })
})

// ── getChoices ────────────────────────────────────────────────────────────────

describe('getChoices', () => {
  it('always includes the correct answer', () => {
    const choices = getChoices(WORDS[0], WORDS, 'word-to-def')
    expect(choices).toContain('яблоко')
  })

  it('returns 4 choices when enough words exist', () => {
    const choices = getChoices(WORDS[0], WORDS, 'word-to-def')
    expect(choices).toHaveLength(4)
  })

  it('returns fewer choices when pool is small', () => {
    const small = WORDS.slice(0, 2)
    const choices = getChoices(small[0], small, 'word-to-def')
    expect(choices.length).toBeLessThanOrEqual(2)
    expect(choices).toContain('яблоко')
  })

  it('does not contain duplicates', () => {
    const choices = getChoices(WORDS[0], WORDS, 'word-to-def')
    expect(new Set(choices).size).toBe(choices.length)
  })

  it('works with def-to-word direction', () => {
    const choices = getChoices(WORDS[0], WORDS, 'def-to-word')
    expect(choices).toContain('apple')
  })
})

// ── getHint ───────────────────────────────────────────────────────────────────

describe('getHint', () => {
  it('shows 1 char for very short answers (≤3 chars)', () => {
    expect(getHint('cat')).toBe('c__')
    expect(getHint('hi')).toBe('h_')
    expect(getHint('x')).toBe('x')
  })

  it('shows first 3 chars for longer answers', () => {
    expect(getHint('apple')).toBe('app__')
    expect(getHint('banana')).toBe('ban___')
  })
})

// ── checkAnswer ───────────────────────────────────────────────────────────────

describe('checkAnswer', () => {
  it('returns true for exact match', () => {
    expect(checkAnswer('яблоко', 'яблоко')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(checkAnswer('Apple', 'apple')).toBe(true)
    expect(checkAnswer('ЯБЛОКО', 'яблоко')).toBe(true)
  })

  it('trims leading/trailing whitespace', () => {
    expect(checkAnswer('  apple  ', 'apple')).toBe(true)
  })

  it('normalises internal whitespace', () => {
    expect(checkAnswer('new  york', 'new york')).toBe(true)
  })

  it('returns false for different words', () => {
    expect(checkAnswer('banana', 'apple')).toBe(false)
  })

  it('returns false for empty input', () => {
    expect(checkAnswer('', 'apple')).toBe(false)
  })

  it('ignores spaces around slash separator', () => {
    // user typed "kriegen/ kriegte / gekriegt", correct is "kriegen / kriegte / gekriegt"
    expect(checkAnswer('kriegen/ kriegte / gekriegt', 'kriegen / kriegte / gekriegt')).toBe(true)
    expect(checkAnswer('kriegen/kriegte/gekriegt', 'kriegen / kriegte / gekriegt')).toBe(true)
    expect(checkAnswer('kriegen / kriegte / gekriegt', 'kriegen/kriegte/gekriegt')).toBe(true)
  })

  it('ignores spaces around comma, semicolon, and pipe separators', () => {
    expect(checkAnswer('a ,b', 'a, b')).toBe(true)
    expect(checkAnswer('a ; b', 'a;b')).toBe(true)
    expect(checkAnswer('a|b', 'a | b')).toBe(true)
  })
})

// ── buildStageQueue ───────────────────────────────────────────────────────────

describe('buildStageQueue', () => {
  it('maps new words to choice phase', () => {
    const queue = buildStageQueue([], WORDS.slice(0, 2))
    expect(queue).toHaveLength(2)
    queue.forEach((item) => expect(item.phase).toBe('choice'))
  })

  it('preserves carry-over phase', () => {
    const carryOvers = [{ wordId: '1', phase: 'type' as const }]
    const queue = buildStageQueue(carryOvers, WORDS.slice(1, 2))
    const carryItem = queue.find((i) => i.wordId === '1')
    expect(carryItem?.phase).toBe('type')
  })

  it('combines carry-overs and new words', () => {
    const carryOvers = [{ wordId: '1', phase: 'type' as const }]
    const queue = buildStageQueue(carryOvers, WORDS.slice(1, 3))
    expect(queue).toHaveLength(3)
  })

  it('returns empty array when both inputs are empty', () => {
    expect(buildStageQueue([], [])).toHaveLength(0)
  })
})

// ── chunkWords ────────────────────────────────────────────────────────────────

describe('chunkWords', () => {
  it('splits words into chunks of given size', () => {
    const chunks = chunkWords(WORDS, 2)
    expect(chunks).toHaveLength(2)
    chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(2))
  })

  it('all words appear exactly once', () => {
    const chunks = chunkWords(WORDS, 3)
    const all = chunks.flat()
    expect(all).toHaveLength(WORDS.length)
    const ids = all.map((w) => w.wordId)
    expect(new Set(ids).size).toBe(WORDS.length)
  })

  it('handles words count equal to chunk size', () => {
    const chunks = chunkWords(WORDS, 4)
    expect(chunks).toHaveLength(1)
  })

  it('handles empty array', () => {
    expect(chunkWords([], 10)).toHaveLength(0)
  })
})

// ── diffInput ─────────────────────────────────────────────────────────────────

describe('diffInput', () => {
  it('marks all chars as ok for a perfect match', () => {
    const result = diffInput('apple', 'apple')
    expect(result.every((c) => c.status === 'ok')).toBe(true)
  })

  it('marks missing chars with status missing', () => {
    const result = diffInput('aple', 'apple')
    const statuses = result.map((c) => c.status)
    expect(statuses).toContain('missing')
  })

  it('marks extra chars with status wrong when divergence is high', () => {
    // Completely different word → all wrong, no underscores
    const result = diffInput('zzz', 'apple')
    expect(result.every((c) => c.status === 'wrong')).toBe(true)
  })

  it('is case-insensitive in matching', () => {
    const result = diffInput('Apple', 'apple')
    expect(result.every((c) => c.status === 'ok')).toBe(true)
  })

  it('returns empty array for empty input against empty correct', () => {
    expect(diffInput('', '')).toHaveLength(0)
  })
})

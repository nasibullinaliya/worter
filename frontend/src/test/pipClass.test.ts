import { describe, it, expect } from 'vitest'
import { pipClass, STAGE_DAYS } from '../pages/Dashboard'

/**
 * SRS pip display logic tests.
 *
 * STAGE_DAYS = [1, 2, 4, 7, 14]  (indices 0–4)
 *
 * Stage semantics:
 *   stage 0 → reset, no active review
 *   stage 1 → first study done, day-1 review PENDING   → pip 0 current
 *   stage 2 → day-1 review done, day-2 review PENDING  → pip 0 violet, pip 1 current
 *   stage 3 → day-2 review done, day-4 review PENDING  → pips 0-1 violet, pip 2 current
 *   stage 4 → day-4 review done, day-7 review PENDING  → pips 0-2 violet, pip 3 current
 *   stage 5 → day-7 review done, day-14 review PENDING → pips 0-3 violet, pip 4 current
 *   stage 6 → cycle complete, all pips violet
 */

const VIOLET  = 'font-bold text-violet-500'
const CURRENT = 'font-bold text-gray-700'
const FUTURE  = 'text-gray-300'

// Helper: get classes for all 5 pips at once
const allPips = (stage: number) => STAGE_DAYS.map((_, i) => pipClass(stage, i))

describe('pipClass — stage 0 (reset)', () => {
  it('all pips are future/grey', () => {
    expect(allPips(0)).toEqual([FUTURE, FUTURE, FUTURE, FUTURE, FUTURE])
  })
})

describe('pipClass — stage 1 (first study done, day-1 pending)', () => {
  it('pip 0 (day 1) is current', () => {
    expect(pipClass(1, 0)).toBe(CURRENT)
  })
  it('pips 1-4 are future', () => {
    expect(pipClass(1, 1)).toBe(FUTURE)
    expect(pipClass(1, 2)).toBe(FUTURE)
    expect(pipClass(1, 3)).toBe(FUTURE)
    expect(pipClass(1, 4)).toBe(FUTURE)
  })
})

describe('pipClass — stage 2 (day-1 done, day-2 pending)', () => {
  it('pip 0 (day 1) is violet / completed', () => {
    expect(pipClass(2, 0)).toBe(VIOLET)
  })
  it('pip 1 (day 2) is current', () => {
    expect(pipClass(2, 1)).toBe(CURRENT)
  })
  it('pips 2-4 are future', () => {
    expect(pipClass(2, 2)).toBe(FUTURE)
    expect(pipClass(2, 3)).toBe(FUTURE)
    expect(pipClass(2, 4)).toBe(FUTURE)
  })
})

describe('pipClass — stage 3 (day-2 done, day-4 pending)', () => {
  it('pips 0-1 (days 1-2) are violet', () => {
    expect(pipClass(3, 0)).toBe(VIOLET)
    expect(pipClass(3, 1)).toBe(VIOLET)
  })
  it('pip 2 (day 4) is current', () => {
    expect(pipClass(3, 2)).toBe(CURRENT)
  })
  it('pips 3-4 (days 7, 14) are future', () => {
    expect(pipClass(3, 3)).toBe(FUTURE)
    expect(pipClass(3, 4)).toBe(FUTURE)
  })
  it('snapshot — full pip row', () => {
    expect(allPips(3)).toEqual([VIOLET, VIOLET, CURRENT, FUTURE, FUTURE])
  })
})

describe('pipClass — stage 4 (day-4 done, day-7 pending)', () => {
  it('pips 0-2 are violet', () => {
    expect(pipClass(4, 0)).toBe(VIOLET)
    expect(pipClass(4, 1)).toBe(VIOLET)
    expect(pipClass(4, 2)).toBe(VIOLET)
  })
  it('pip 3 (day 7) is current', () => {
    expect(pipClass(4, 3)).toBe(CURRENT)
  })
  it('pip 4 (day 14) is future', () => {
    expect(pipClass(4, 4)).toBe(FUTURE)
  })
  it('snapshot — full pip row', () => {
    expect(allPips(4)).toEqual([VIOLET, VIOLET, VIOLET, CURRENT, FUTURE])
  })
})

describe('pipClass — stage 5 (day-7 done, day-14 pending)', () => {
  it('pips 0-3 are violet', () => {
    ;[0, 1, 2, 3].forEach((i) => expect(pipClass(5, i)).toBe(VIOLET))
  })
  it('pip 4 (day 14) is current', () => {
    expect(pipClass(5, 4)).toBe(CURRENT)
  })
  it('snapshot — full pip row', () => {
    expect(allPips(5)).toEqual([VIOLET, VIOLET, VIOLET, VIOLET, CURRENT])
  })
})

describe('pipClass — stage 6 (cycle complete)', () => {
  it('all pips are violet', () => {
    expect(allPips(6)).toEqual([VIOLET, VIOLET, VIOLET, VIOLET, VIOLET])
  })
})

describe('pipClass — regression: old off-by-one bug', () => {
  it('stage 3 must NOT mark pip 2 (day 4) as violet — it must be current', () => {
    expect(pipClass(3, 2)).not.toBe(VIOLET)
    expect(pipClass(3, 2)).toBe(CURRENT)
  })
  it('stage 3 must NOT mark pip 3 (day 7) as current — it must be future', () => {
    expect(pipClass(3, 3)).not.toBe(CURRENT)
    expect(pipClass(3, 3)).toBe(FUTURE)
  })
  it('stage 5 must NOT show all violet — pip 4 must still be current', () => {
    expect(pipClass(5, 4)).not.toBe(VIOLET)
    expect(pipClass(5, 4)).toBe(CURRENT)
  })
})

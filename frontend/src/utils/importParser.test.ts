import { describe, it, expect } from 'vitest'
import { parseImportText, analyzeImport } from './importParser'

describe('parseImportText', () => {
  describe('default separator (-)', () => {
    it('parses basic word-translation pairs', () => {
      const result = parseImportText('apple - яблоко\nbanana - банан')
      expect(result).toEqual([
        { term: 'apple', definition: 'яблоко' },
        { term: 'banana', definition: 'банан' },
      ])
    })

    it('trims whitespace around terms and definitions', () => {
      const result = parseImportText('  apple  -  яблоко  ')
      expect(result).toEqual([{ term: 'apple', definition: 'яблоко' }])
    })

    it('ignores empty lines', () => {
      const result = parseImportText('apple - яблоко\n\n\nbanana - банан')
      expect(result).toHaveLength(2)
    })

    it('ignores lines without the separator', () => {
      const result = parseImportText('just a word\napple - яблоко')
      expect(result).toEqual([{ term: 'apple', definition: 'яблоко' }])
    })

    it('ignores lines where term or definition is empty after split', () => {
      const result = parseImportText('- яблоко\napple -')
      expect(result).toHaveLength(0)
    })

    it('splits only on the first occurrence of the separator', () => {
      // definition contains the separator character
      const result = parseImportText('A - B - C')
      expect(result).toEqual([{ term: 'A', definition: 'B - C' }])
    })

    it('returns empty array for empty input', () => {
      expect(parseImportText('')).toEqual([])
    })

    it('returns empty array for whitespace-only input', () => {
      expect(parseImportText('   \n  \n  ')).toEqual([])
    })
  })

  describe('tab separator', () => {
    it('parses tab-separated pairs regardless of configured separator', () => {
      const result = parseImportText('apple\tяблоко', '-')
      expect(result).toEqual([{ term: 'apple', definition: 'яблоко' }])
    })

    it('tab takes priority over configured separator on the same line', () => {
      const result = parseImportText('apple\tяблоко - fruit', '-')
      expect(result).toEqual([{ term: 'apple', definition: 'яблоко - fruit' }])
    })

    it('handles mixed tab and dash lines', () => {
      const result = parseImportText('apple\tяблоко\nbanana - банан')
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ term: 'apple', definition: 'яблоко' })
      expect(result[1]).toEqual({ term: 'banana', definition: 'банан' })
    })
  })

  describe('custom separator', () => {
    it('uses the provided separator', () => {
      const result = parseImportText('apple = яблоко', '=')
      expect(result).toEqual([{ term: 'apple', definition: 'яблоко' }])
    })

    it('uses colon as separator', () => {
      const result = parseImportText('apple: яблоко\nbanana: банан', ':')
      expect(result).toHaveLength(2)
    })

    it('falls back to dash when separator is empty or whitespace', () => {
      const result = parseImportText('apple - яблоко', ' ')
      // ' '.trim() → '' → falls back to '-'
      expect(result).toEqual([{ term: 'apple', definition: 'яблоко' }])
    })
  })
})

// ── analyzeImport ────────────────────────────────────────────────────────────

describe('analyzeImport', () => {
  const noUserWords: { term: string; setId: string; setTitle: string }[] = []

  describe('duplicates (same term, same definition)', () => {
    it('returns empty duplicates when all terms are unique', () => {
      const parsed = [
        { term: 'apple', definition: 'яблоко' },
        { term: 'banana', definition: 'банан' },
      ]
      const result = analyzeImport(parsed, noUserWords)
      expect(result.duplicates).toHaveLength(0)
    })

    it('detects an exact duplicate pair', () => {
      const parsed = [
        { term: 'apple', definition: 'яблоко' },
        { term: 'apple', definition: 'яблоко' },
      ]
      const result = analyzeImport(parsed, noUserWords)
      expect(result.duplicates).toContain('apple')
    })

    it('is case-insensitive for duplicate detection', () => {
      const parsed = [
        { term: 'Apple', definition: 'яблоко' },
        { term: 'apple', definition: 'яблоко' },
      ]
      const result = analyzeImport(parsed, noUserWords)
      expect(result.duplicates).toHaveLength(1)
    })

    it('does not put a term in duplicates when definitions differ (goes to conflicts)', () => {
      const parsed = [
        { term: 'apple', definition: 'яблоко' },
        { term: 'apple', definition: 'яблочко' },
      ]
      const result = analyzeImport(parsed, noUserWords)
      expect(result.duplicates).toHaveLength(0)
    })
  })

  describe('conflicts (same term, different definitions)', () => {
    it('returns empty conflicts when no conflicts exist', () => {
      const parsed = [
        { term: 'apple', definition: 'яблоко' },
        { term: 'banana', definition: 'банан' },
      ]
      const result = analyzeImport(parsed, noUserWords)
      expect(result.conflicts).toHaveLength(0)
    })

    it('detects a conflict when the same term has two different definitions', () => {
      const parsed = [
        { term: 'apple', definition: 'яблоко' },
        { term: 'apple', definition: 'яблочко' },
      ]
      const result = analyzeImport(parsed, noUserWords)
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].term).toBe('apple')
      expect(result.conflicts[0].defs).toContain('яблоко')
      expect(result.conflicts[0].defs).toContain('яблочко')
    })

    it('is case-insensitive when comparing definitions', () => {
      const parsed = [
        { term: 'apple', definition: 'Яблоко' },
        { term: 'apple', definition: 'яблоко' },
      ]
      // same definition (case-insensitive) → duplicate, not conflict
      const result = analyzeImport(parsed, noUserWords)
      expect(result.duplicates).toContain('apple')
      expect(result.conflicts).toHaveLength(0)
    })

    it('collects all distinct definitions for a conflicting term', () => {
      const parsed = [
        { term: 'apple', definition: 'яблоко' },
        { term: 'apple', definition: 'яблочко' },
        { term: 'apple', definition: 'яблоко' }, // repeat — should not duplicate in defs list
      ]
      const result = analyzeImport(parsed, noUserWords)
      expect(result.conflicts[0].defs).toHaveLength(2)
    })
  })

  describe('existingInOtherSets', () => {
    const userWords = [
      { term: 'apple', setId: 'set-1', setTitle: 'Food' },
      { term: 'banana', setId: 'set-2', setTitle: 'Fruits' },
    ]

    it('returns empty when no imported terms exist in other sets', () => {
      const parsed = [{ term: 'cherry', definition: 'вишня' }]
      const result = analyzeImport(parsed, userWords)
      expect(result.existingInOtherSets).toHaveLength(0)
    })

    it('detects a term that already exists in another set', () => {
      const parsed = [{ term: 'apple', definition: 'яблоко' }]
      const result = analyzeImport(parsed, userWords)
      expect(result.existingInOtherSets).toHaveLength(1)
      expect(result.existingInOtherSets[0].term).toBe('apple')
      expect(result.existingInOtherSets[0].setTitles).toContain('Food')
    })

    it('is case-insensitive when matching against user words', () => {
      const parsed = [{ term: 'Apple', definition: 'яблоко' }]
      const result = analyzeImport(parsed, userWords)
      expect(result.existingInOtherSets).toHaveLength(1)
    })

    it('excludes words belonging to the current set (currentSetId)', () => {
      const parsed = [{ term: 'apple', definition: 'яблоко' }]
      const result = analyzeImport(parsed, userWords, 'set-1')
      expect(result.existingInOtherSets).toHaveLength(0)
    })

    it('includes the set from a different id even when currentSetId is provided', () => {
      const parsed = [{ term: 'apple', definition: 'яблоко' }]
      const result = analyzeImport(parsed, userWords, 'set-99')
      expect(result.existingInOtherSets).toHaveLength(1)
      expect(result.existingInOtherSets[0].setTitles).toContain('Food')
    })

    it('aggregates multiple sets that contain the same term', () => {
      const multiSetWords = [
        { term: 'apple', setId: 'set-1', setTitle: 'Food' },
        { term: 'apple', setId: 'set-2', setTitle: 'Fruits' },
      ]
      const parsed = [{ term: 'apple', definition: 'яблоко' }]
      const result = analyzeImport(parsed, multiSetWords)
      expect(result.existingInOtherSets[0].setTitles).toContain('Food')
      expect(result.existingInOtherSets[0].setTitles).toContain('Fruits')
    })
  })

  describe('combined results', () => {
    it('returns no warnings for a clean import', () => {
      const parsed = [
        { term: 'apple', definition: 'яблоко' },
        { term: 'banana', definition: 'банан' },
      ]
      const result = analyzeImport(parsed, noUserWords)
      expect(result.duplicates).toHaveLength(0)
      expect(result.conflicts).toHaveLength(0)
      expect(result.existingInOtherSets).toHaveLength(0)
    })

    it('returns all warning types at once when all issues are present', () => {
      const parsed = [
        { term: 'apple', definition: 'яблоко' },   // dup
        { term: 'apple', definition: 'яблоко' },   // dup
        { term: 'cherry', definition: 'вишня' },   // conflict def 1
        { term: 'cherry', definition: 'черешня' }, // conflict def 2
        { term: 'banana', definition: 'банан' },   // existing in other set
      ]
      const userWords = [{ term: 'banana', setId: 'set-1', setTitle: 'Food' }]
      const result = analyzeImport(parsed, userWords)
      expect(result.duplicates).toContain('apple')
      expect(result.conflicts[0].term).toBe('cherry')
      expect(result.existingInOtherSets[0].term).toBe('banana')
    })
  })
})

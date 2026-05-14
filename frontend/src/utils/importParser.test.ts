import { describe, it, expect } from 'vitest'
import { parseImportText } from './importParser'

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

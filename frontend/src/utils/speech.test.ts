import { describe, it, expect } from 'vitest'
import { detectLang } from './speech'

describe('detectLang', () => {
  it('returns ru-RU for Cyrillic text', () => {
    expect(detectLang('привет')).toBe('ru-RU')
    expect(detectLang('яблоко')).toBe('ru-RU')
    expect(detectLang('Ё')).toBe('ru-RU')
  })

  it('returns de-DE for Latin text', () => {
    expect(detectLang('hello')).toBe('de-DE')
    expect(detectLang('Apfel')).toBe('de-DE')
    expect(detectLang('über')).toBe('de-DE')
  })

  it('returns ru-RU for mixed Latin+Cyrillic text', () => {
    expect(detectLang('hello мир')).toBe('ru-RU')
  })

  it('returns de-DE for empty string', () => {
    expect(detectLang('')).toBe('de-DE')
  })

  it('returns de-DE for numbers and punctuation', () => {
    expect(detectLang('123 !')).toBe('de-DE')
  })
})

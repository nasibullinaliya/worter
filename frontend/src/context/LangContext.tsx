import { createContext, useContext, useState, type ReactNode } from 'react'
import {
  type Lang,
  type TKey,
  getT,
  getWordLabel,
  getSetLabel,
  getDateLocale,
} from '../i18n/translations'

interface LangContextType {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TKey) => string
  wl: (n: number) => string
  sl: (n: number) => string
  dateLocale: string
}

const LangContext = createContext<LangContextType | null>(null)

const STORAGE_KEY = 'vocab_lang'
const LANGS: Lang[] = ['ru', 'en', 'de']

function readLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && LANGS.includes(stored as Lang)) return stored as Lang
  return 'ru'
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang)

  const setLang = (l: Lang) => {
    localStorage.setItem(STORAGE_KEY, l)
    setLangState(l)
  }

  const value: LangContextType = {
    lang,
    setLang,
    t: getT(lang),
    wl: (n) => getWordLabel(lang, n),
    sl: (n) => getSetLabel(lang, n),
    dateLocale: getDateLocale(lang),
  }

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside LangProvider')
  return ctx
}

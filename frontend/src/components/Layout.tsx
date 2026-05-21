import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import type { Lang } from '../i18n/translations'

interface Props {
  children: React.ReactNode
  reminderCount?: number
}

const LANG_LABELS: Record<Lang, string> = { ru: 'RU', en: 'EN', de: 'DE' }

function LangDropdown() {
  const { lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <span className="bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] bg-clip-text text-transparent">
          {LANG_LABELS[lang]}
        </span>
        <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md z-50">
          {(['ru', 'en', 'de'] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => { setLang(l); setOpen(false) }}
              className={`px-4 py-1.5 text-xs font-semibold text-left transition-colors hover:bg-gray-50 ${
                lang === l
                  ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] bg-clip-text text-transparent'
                  : 'text-gray-400'
              }`}
            >
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Layout({ children, reminderCount }: Props) {
  const { user, logout } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navCls = (path: string) => {
    const active =
      location.pathname === path ||
      (path !== '/dashboard' && location.pathname.startsWith(path))
    return active
      ? 'text-xs font-semibold text-violet-700 border-b-2 border-violet-600 pb-0.5'
      : 'text-xs font-medium text-gray-500 hover:text-violet-600 transition-colors'
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-3">
          {/* Main row */}
          <div className="flex items-center justify-between">
            {/* Left: logo + desktop nav */}
            <div className="flex items-center gap-7">
              <Link
                to="/dashboard"
                className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] bg-clip-text text-transparent"
              >
                Wörter
              </Link>

              {/* Desktop nav links */}
              <nav className="hidden items-center gap-6 sm:flex">
                <Link to="/dashboard" className={navCls('/dashboard')}>
                  {t('nav.mySets')}
                </Link>
                <Link to="/explore" className={navCls('/explore')}>
                  {t('nav.explore')}
                </Link>
                <Link to="/plan" className={`relative ${navCls('/plan')}`}>
                  {t('nav.plan')}
                  {reminderCount != null && reminderCount > 0 && (
                    <span className="absolute -right-4 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                      {reminderCount > 9 ? '9+' : reminderCount}
                    </span>
                  )}
                </Link>
              </nav>
            </div>

            {/* Right: lang switcher + user + logout */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Language switcher */}
              <LangDropdown />

              <span className="hidden text-sm text-gray-400 sm:block">
                {user?.name ?? user?.email}
              </span>
              <button
                onClick={handleLogout}
                className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {t('nav.logout')}
              </button>
            </div>
          </div>

          {/* Mobile nav row */}
          <nav className="flex items-center gap-5 border-t border-gray-100 pt-2 mt-2 sm:hidden">
            <Link to="/dashboard" className={navCls('/dashboard')}>
              {t('nav.mySets')}
            </Link>
            <Link to="/explore" className={navCls('/explore')}>
              {t('nav.explore')}
            </Link>
            <Link to="/plan" className={`relative ${navCls('/plan')}`}>
              {t('nav.plan')}
              {reminderCount != null && reminderCount > 0 && (
                <span className="absolute -right-4 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                  {reminderCount > 9 ? '9+' : reminderCount}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  )
}

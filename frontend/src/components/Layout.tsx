import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import type { Lang } from '../i18n/translations'

interface Props {
  children: React.ReactNode
  reminderCount?: number
}

const LANG_LABELS: Record<Lang, string> = { ru: 'RU', en: 'EN', de: 'DE' }

export function Layout({ children, reminderCount }: Props) {
  const { user, logout } = useAuth()
  const { t, lang, setLang } = useLang()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-3">
          {/* Main row */}
          <div className="flex items-center justify-between">
            {/* Left: logo + desktop nav */}
            <div className="flex items-center gap-6">
              <Link to="/dashboard" className="text-xl font-bold text-indigo-600">
                Wörter
              </Link>
              {/* Desktop nav links */}
              <nav className="hidden items-center gap-6 sm:flex">
                <Link to="/dashboard" className="relative text-sm text-gray-600 hover:text-indigo-600">
                  {t('nav.mySets')}
                  {reminderCount != null && reminderCount > 0 && (
                    <span className="absolute -right-4 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                      {reminderCount > 9 ? '9+' : reminderCount}
                    </span>
                  )}
                </Link>
                <Link to="/explore" className="text-sm text-gray-600 hover:text-indigo-600">
                  {t('nav.explore')}
                </Link>
              </nav>
            </div>

            {/* Right: lang switcher + user + logout */}
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs">
                {(['ru', 'en', 'de'] as Lang[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`px-2 py-1 font-medium transition-colors ${
                      lang === l ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {LANG_LABELS[l]}
                  </button>
                ))}
              </div>
              <span className="hidden text-sm text-gray-500 sm:block">{user?.name ?? user?.email}</span>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              >
                {t('nav.logout')}
              </button>
            </div>
          </div>

          {/* Mobile nav row */}
          <nav className="flex items-center gap-5 border-t border-gray-100 pt-2 mt-2 sm:hidden">
            <Link to="/dashboard" className="relative text-sm text-gray-600 hover:text-indigo-600">
              {t('nav.mySets')}
              {reminderCount != null && reminderCount > 0 && (
                <span className="absolute -right-4 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                  {reminderCount > 9 ? '9+' : reminderCount}
                </span>
              )}
            </Link>
            <Link to="/explore" className="text-sm text-gray-600 hover:text-indigo-600">
              {t('nav.explore')}
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  )
}

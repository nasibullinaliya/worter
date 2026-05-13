import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import type { Lang } from '../i18n/translations'

const LANG_LABELS: Record<Lang, string> = { ru: 'RU', en: 'EN', de: 'DE' }

export default function Login() {
  const { login } = useAuth()
  const { t, lang, setLang } = useLang()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.message ?? t('auth.signingIn'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Wörter</h1>
          <p className="mt-2 text-sm text-gray-600">{t('auth.loginTitle')}</p>
          {/* Language switcher on auth pages */}
          <div className="mt-3 flex justify-center">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              {(['ru', 'en', 'de'] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    lang === l ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {LANG_LABELS[l]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-8 shadow">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('auth.password')}</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? t('auth.signingIn') : t('auth.signIn')}
          </button>

          <p className="text-center text-sm text-gray-600">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="font-medium text-indigo-600 hover:underline">
              {t('auth.signUp')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

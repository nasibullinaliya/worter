import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import type { Lang } from '../i18n/translations'

const LANG_LABELS: Record<Lang, string> = { ru: 'RU', en: 'EN', de: 'DE' }

export default function Login() {
  const { loginWithGoogle } = useAuth()
  const { t, lang, setLang } = useLang()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGoogleSuccess = async (credential: string) => {
    setError('')
    setLoading(true)
    try {
      await loginWithGoogle(credential)
      navigate('/dashboard')
    } catch {
      setError(t('auth.googleError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo + title */}
        <div className="text-center">
          <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] bg-clip-text text-transparent">Wörter</h1>
          <p className="mt-2 text-sm text-gray-500">{t('auth.subtitle')}</p>

          {/* Language switcher */}
          <div className="mt-4 flex justify-center">
            <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs">
              {(['ru', 'en', 'de'] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-1.5 py-0.5 font-semibold transition-colors ${
                    lang === l
                      ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] bg-clip-text text-transparent'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {LANG_LABELS[l]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-900/5">
          {error && (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
            </div>
          ) : (
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={(cred) => {
                  if (cred.credential) handleGoogleSuccess(cred.credential)
                }}
                onError={() => setError(t('auth.googleError'))}
                theme="outline"
                size="large"
                width="280"
                text="continue_with"
                shape="rectangular"
                logo_alignment="left"
              />
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

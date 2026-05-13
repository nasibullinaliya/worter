import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSet, addWords } from '../api/sets'
import { parseImportText } from '../utils/importParser'
import { Layout } from '../components/Layout'
import { useLang } from '../context/LangContext'

export default function SetNew() {
  const navigate = useNavigate()
  const { t, wl } = useLang()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [importText, setImportText] = useState('')
  const [separator, setSeparator] = useState('-')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const parsedCount = importText.trim() ? parseImportText(importText, separator).length : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const words = importText.trim() ? parseImportText(importText, separator) : []
    if (importText.trim() && words.length === 0) {
      setError(t('form.parseError'))
      return
    }

    setLoading(true)
    try {
      const set = await createSet({ title, description: description || undefined, isPublic })
      if (words.length > 0) {
        await addWords(set.id, words)
      }
      navigate(`/sets/${set.id}`)
    } catch (err: any) {
      setError(err.response?.data?.message ?? t('form.createError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">{t('form.newSet')}</h2>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border bg-white p-6 shadow-sm">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('form.title')}</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="English words — B1 level"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('form.description')}</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder={t('form.optional')}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isPublic ? 'bg-indigo-600' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                isPublic ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
            <span className="text-sm text-gray-700">
              {isPublic ? t('form.publicDesc') : t('form.privateDesc')}
            </span>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('form.importWords')}
            </label>
            {/* Separator row */}
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm text-gray-500">{t('form.separator')}:</span>
              <input
                type="text"
                value={separator}
                onChange={(e) => setSeparator(e.target.value)}
                className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-center font-mono text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-xs text-gray-400">
                {t('form.importHint').replace('{sep}', separator || '-')}
              </span>
            </div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder={`apple ${separator || '-'} яблоко\nbanana ${separator || '-'} банан`}
            />
            {importText.trim() && (
              <p className={`mt-1 text-xs ${parsedCount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {parsedCount > 0
                  ? `${t('form.recognized')} ${parsedCount} ${wl(parsedCount)}`
                  : t('form.notRecognized')}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? t('form.creating') : t('form.createSet')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="rounded-lg border border-gray-300 px-6 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  )
}

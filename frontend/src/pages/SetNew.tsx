import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSet, addWords } from '../api/sets'
import { getFolders, type FolderDto } from '../api/folders'
import { getAllWords, type AllWordsItemDto } from '../api/progress'
import { parseImportText, analyzeImport } from '../utils/importParser'
import { Layout } from '../components/Layout'
import { useLang } from '../context/LangContext'

export default function SetNew() {
  const navigate = useNavigate()
  const { t, wl } = useLang()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [language, setLanguage] = useState('de-DE')
  const [importText, setImportText] = useState('')
  const [separator, setSeparator] = useState('-')
  const [folderId, setFolderId] = useState<string | null>(null)
  const [folders, setFolders] = useState<FolderDto[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [allUserWords, setAllUserWords] = useState<AllWordsItemDto[]>([])
  useEffect(() => { getAllWords().then(setAllUserWords).catch(() => {}) }, [])
  useEffect(() => { getFolders().then(setFolders).catch(() => {}) }, [])

  const parsedWords = useMemo(
    () => (importText.trim() ? parseImportText(importText, separator) : []),
    [importText, separator],
  )
  const parsedCount = parsedWords.length

  const importWarnings = useMemo(() => {
    if (parsedWords.length === 0) return null
    return analyzeImport(parsedWords, allUserWords)
  }, [parsedWords, allUserWords])

  const inputCls =
    'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-shadow'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const words = parsedWords
    if (importText.trim() && parsedWords.length === 0) {
      setError(t('form.parseError'))
      return
    }

    setLoading(true)
    try {
      const set = await createSet({ title, description: description || undefined, isPublic, language, folderId })
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

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('form.title')}</label>
            <input
                              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
              placeholder="English words — B1 level"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('form.description')}</label>
            <input
                              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputCls}
              placeholder={t('form.optional')}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('form.language')}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            >
              <option value="de-DE">DE · Deutsch</option>
              <option value="en-US">EN · English (US)</option>
              <option value="en-GB">EN · English (UK)</option>
              <option value="fr-FR">FR · Français</option>
              <option value="es-ES">ES · Español</option>
              <option value="it-IT">IT · Italiano</option>
            </select>
          </div>

          {folders.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('form.folder')}</label>
              <select
                value={folderId ?? ''}
                onChange={(e) => setFolderId(e.target.value || null)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              >
                <option value="">{t('form.noFolder')}</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isPublic ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  isPublic ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-gray-600">
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
                className="w-20 rounded-xl border border-gray-200 px-2 py-1 text-center font-mono text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
              <span className="text-xs text-gray-400">
                {t('form.importHint').replace('{sep}', separator || '-')}
              </span>
            </div>
            <textarea
                              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={8}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 font-mono text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              placeholder={`apple ${separator || '-'} яблоко ${separator || '-'} I eat an apple every day\nbanana ${separator || '-'} банан`}
            />
            {importText.trim() && (
              <p className={`mt-1 text-xs ${parsedCount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {parsedCount > 0
                  ? `${t('form.recognized')} ${parsedCount} ${wl(parsedCount)}`
                  : t('form.notRecognized')}
              </p>
            )}
            {importWarnings && (
              importWarnings.duplicates.length > 0 ||
              importWarnings.conflicts.length > 0 ||
              importWarnings.existingInOtherSets.length > 0
            ) && (
              <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 space-y-1">
                {importWarnings.duplicates.length > 0 && (
                  <p>⚠ {t('form.warnDuplicate')} {importWarnings.duplicates.join(', ')}</p>
                )}
                {importWarnings.conflicts.map(({ term, defs }) => (
                  <p key={term}>⚠ {t('form.warnConflict')} «{term}»: {defs.join(' / ')}</p>
                ))}
                {importWarnings.existingInOtherSets.map(({ term, setTitles }) => (
                  <p key={term}>⚠ {t('form.warnInOtherSets')} «{term}» ({setTitles.map(s => `«${s}»`).join(', ')})</p>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] px-6 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 transition-colors"
            >
              {loading ? t('form.creating') : t('form.createSet')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="rounded-full border border-gray-200 px-6 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  )
}

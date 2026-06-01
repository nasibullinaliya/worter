import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getSet, updateSet, addWords, updateWord, deleteWord, swapAllWords, type SetDetailDto, type WordDto } from '../api/sets'
import { getAllWords, type AllWordsItemDto } from '../api/progress'
import { parseImportText, analyzeImport } from '../utils/importParser'
import { Layout } from '../components/Layout'
import { useLang } from '../context/LangContext'

export default function SetEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, wl } = useLang()

  const [set, setSet] = useState<SetDetailDto | null>(null)
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [language, setLanguage] = useState('de-DE')
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTerm, setEditTerm] = useState('')
  const [editDef, setEditDef] = useState('')
  const [editExample, setEditExample] = useState('')

  const [newTerm, setNewTerm] = useState('')
  const [newDef, setNewDef] = useState('')
  const [newExample, setNewExample] = useState('')
  const [swappingId, setSwappingId] = useState<string | null>(null)
  const [swappingAll, setSwappingAll] = useState(false)

  const [importText, setImportText] = useState('')
  const [importMode, setImportMode] = useState(false)
  const [separator, setSeparator] = useState('-')

  const [allUserWords, setAllUserWords] = useState<AllWordsItemDto[]>([])
  useEffect(() => { getAllWords().then(setAllUserWords).catch(() => {}) }, [])

  const [error, setError] = useState('')

  const inputCls =
    'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-shadow'

  useEffect(() => {
    if (!id) return
    getSet(id)
      .then((s) => {
        if (!s.isOwner) { navigate(`/sets/${id}`); return }
        setSet(s)
        setTitle(s.title)
        setDescription(s.description ?? '')
        setIsPublic(s.isPublic)
        setLanguage(s.language ?? 'de-DE')
      })
      .catch(() => setError(t('form.notFoundError')))
      .finally(() => setLoading(false))
  }, [id])

  const handleSaveSettings = async () => {
    if (!set || !title.trim()) return
    setSaving(true)
    try {
      await updateSet(set.id, { title: title.trim(), description: description.trim() || undefined, isPublic, language })
      setSet((prev) =>
        prev
          ? { ...prev, title: title.trim(), description: description.trim() || null, isPublic, language }
          : prev
      )
    } catch {
      setError(t('form.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (word: WordDto) => {
    setEditingId(word.id)
    setEditTerm(word.term)
    setEditDef(word.definition)
    setEditExample(word.example ?? '')
  }

  const saveEdit = async (wordId: string) => {
    if (!editTerm.trim() || !editDef.trim()) return
    const updated = await updateWord(wordId, {
      term: editTerm.trim(),
      definition: editDef.trim(),
      example: editExample.trim() || undefined,
    })
    setSet((prev) =>
      prev ? { ...prev, words: prev.words.map((w) => (w.id === wordId ? updated : w)) } : prev
    )
    setEditingId(null)
  }

  const handleDeleteWord = async (wordId: string) => {
    await deleteWord(wordId)
    setSet((prev) => (prev ? { ...prev, words: prev.words.filter((w) => w.id !== wordId) } : prev))
  }

  const handleAddWord = async () => {
    if (!set || !newTerm.trim() || !newDef.trim()) return
    const added = await addWords(set.id, [{
      term: newTerm.trim(),
      definition: newDef.trim(),
      example: newExample.trim() || undefined,
    }])
    setSet((prev) => (prev ? { ...prev, words: [...prev.words, ...added] } : prev))
    setNewTerm('')
    setNewDef('')
    setNewExample('')
  }

  const importParsed = useMemo(
    () => (importText.trim() ? parseImportText(importText, separator) : []),
    [importText, separator],
  )

  const importWarnings = useMemo(() => {
    if (importParsed.length === 0) return null
    return analyzeImport(importParsed, allUserWords, set?.id)
  }, [importParsed, allUserWords, set?.id])

  const handleSwapWord = async (word: WordDto) => {
    if (swappingId) return
    setSwappingId(word.id)
    try {
      const updated = await updateWord(word.id, {
        term: word.definition,
        definition: word.term,
        example: word.example ?? undefined,
      })
      setSet((prev) =>
        prev ? { ...prev, words: prev.words.map((w) => (w.id === word.id ? updated : w)) } : prev
      )
    } finally {
      setSwappingId(null)
    }
  }

  // ── Duplicate detection ───────────────────────────────────────────────────
  const intraDups = useMemo(() => {
    if (!set) return new Set<string>()
    const count = new Map<string, number>()
    for (const w of set.words) {
      const k = w.term.toLowerCase().trim()
      count.set(k, (count.get(k) ?? 0) + 1)
    }
    return new Set([...count.entries()].filter(([, c]) => c > 1).map(([k]) => k))
  }, [set?.words])

  const crossMap = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const w of allUserWords) {
      if (w.setId === set?.id) continue
      const k = w.term.toLowerCase().trim()
      if (!map.has(k)) map.set(k, [])
      if (!map.get(k)!.includes(w.setTitle)) map.get(k)!.push(w.setTitle)
    }
    return map
  }, [allUserWords, set?.id])

  const handleSwapAll = async () => {
    if (!set || swappingAll) return
    setSwappingAll(true)
    try {
      const updated = await swapAllWords(set.id)
      setSet((prev) => (prev ? { ...prev, words: updated } : prev))
    } finally {
      setSwappingAll(false)
    }
  }

  const handleImport = async () => {
    if (!set || !importText.trim()) return
    if (importParsed.length === 0) { setError(t('form.notRecognized')); return }
    const added = await addWords(set.id, importParsed)
    setSet((prev) => (prev ? { ...prev, words: [...prev.words, ...added] } : prev))
    setImportText('')
    setImportMode(false)
  }

  if (loading) return (
    <Layout>
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
      </div>
    </Layout>
  )

  if (!set) return <Layout><p className="text-red-500">{error}</p></Layout>

  return (
    <Layout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{t('form.editing')}</h2>
          <button
            onClick={() => navigate(`/sets/${set.id}`)}
            className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            {t('form.backToSet')}
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Settings */}
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">{t('form.setSettings')}</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('form.title')}</label>
              <input
                                  value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('form.description')}</label>
              <input
                                  value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputCls}
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
                {isPublic ? t('common.public') : t('common.private')}
              </span>
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="rounded-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 transition-colors"
            >
              {saving ? t('common.saving') : t('form.saveSettings')}
            </button>
          </div>
        </section>

        {/* Words */}
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-50 px-5 py-3">
            <h3 className="font-semibold text-gray-900">
              {t('form.wordsSection')} ({set.words.length})
            </h3>
            <div className="flex items-center gap-3">
              {set.words.length > 0 && (
                <button
                  onClick={handleSwapAll}
                  disabled={swappingAll}
                  className="text-sm font-medium text-gray-400 hover:text-violet-600 disabled:opacity-50 transition-colors"
                >
                  {swappingAll ? '...' : t('form.swapAll')}
                </button>
              )}
              <button
                onClick={() => setImportMode(!importMode)}
                className="text-sm font-medium text-violet-600 hover:text-violet-800 transition-colors"
              >
                {importMode ? t('form.hideImport') : t('form.showImport')}
              </button>
            </div>
          </div>

          {importMode && (
            <div className="border-b border-gray-50 p-5">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm text-gray-500">{t('form.separator')}:</span>
                <input
                                      type="text"
                  value={separator}
                  onChange={(e) => setSeparator(e.target.value)}
                  className="w-20 rounded-xl border border-gray-200 px-2 py-1 text-center font-mono text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>
              <textarea
                                  value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={6}
                placeholder={`apple ${separator || '-'} яблоко ${separator || '-'} I eat an apple every day\nbanana ${separator || '-'} банан`}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 font-mono text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
              {importText.trim() && (
                <p className={`mt-1 text-xs ${importParsed.length > 0 ? 'text-gray-500' : 'text-red-500'}`}>
                  {importParsed.length > 0
                    ? `${t('form.recognized')} ${importParsed.length} ${wl(importParsed.length)}`
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
              <button
                onClick={handleImport}
                className="mt-2 rounded-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity transition-colors"
              >
                {t('common.add')}
              </button>
            </div>
          )}

          {set.words.map((word, i) => (
            <div
              key={word.id}
              className={`px-5 py-3 ${i !== set.words.length - 1 ? 'border-b border-gray-50' : ''}`}
            >
              {editingId === word.id ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                                              value={editTerm}
                      onChange={(e) => setEditTerm(e.target.value)}
                      placeholder={t('form.word')}
                      className="flex-1 rounded-xl border border-gray-200 px-2 py-1 text-sm outline-none focus:border-violet-400"
                    />
                    <input
                                              value={editDef}
                      onChange={(e) => setEditDef(e.target.value)}
                      placeholder={t('form.translation')}
                      className="flex-1 rounded-xl border border-gray-200 px-2 py-1 text-sm outline-none focus:border-violet-400"
                    />
                    <button
                      onClick={() => saveEdit(word.id)}
                      className="text-sm font-medium text-violet-600 hover:text-violet-800 transition-colors"
                    >
                      {t('common.save')}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                  <input
                                          value={editExample}
                    onChange={(e) => setEditExample(e.target.value)}
                    placeholder={t('form.examplePlaceholder')}
                    className="w-full rounded-xl border border-gray-200 px-2 py-1 text-sm text-gray-500 italic outline-none focus:border-violet-400"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <span className="w-6 shrink-0 text-sm text-gray-300">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5 font-medium text-gray-900">
                      {word.term}
                      {intraDups.has(word.term.toLowerCase().trim()) && (
                        <span className="group relative cursor-default">
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">×2</span>
                          <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs text-gray-500 shadow-md group-hover:block">
                            {t('set.dupInSet')}
                          </span>
                        </span>
                      )}
                      {(crossMap.get(word.term.toLowerCase().trim()) ?? []).length > 0 && (() => {
                        const sets = crossMap.get(word.term.toLowerCase().trim())!
                        return (
                          <span className="group relative cursor-default">
                            <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                              {sets.length === 1 ? sets[0] : `${sets.length} sets`}
                            </span>
                            <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs text-gray-500 shadow-md group-hover:block">
                              <span className="block font-semibold text-gray-700 mb-1">{t('set.inOtherSets')}:</span>
                              {sets.map((s) => <span key={s} className="block">{s}</span>)}
                            </span>
                          </span>
                        )
                      })()}
                    </span>
                    {word.example && (
                      <p className="mt-0.5 text-xs italic text-gray-400 truncate">{word.example}</p>
                    )}
                  </div>
                  <span className="flex-1 text-sm text-gray-500">{word.definition}</span>
                  <div className="flex shrink-0 gap-3">
                    <button
                      onClick={() => handleSwapWord(word)}
                      disabled={swappingId === word.id}
                      title={t('form.swapWord')}
                      className="text-xs text-gray-300 hover:text-violet-500 disabled:opacity-40 transition-colors"
                    >
                      {swappingId === word.id ? '...' : '⇄'}
                    </button>
                    <button
                      onClick={() => startEdit(word)}
                      className="text-xs font-medium text-gray-400 hover:text-violet-600 transition-colors"
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      onClick={() => handleDeleteWord(word.id)}
                      className="text-xs text-red-300 hover:text-red-500 transition-colors"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="border-t border-gray-50 p-5">
            <p className="mb-2 text-sm font-medium text-gray-700">{t('form.addWord')}</p>
            <div className="flex gap-2">
              <input
                                  value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                placeholder={t('form.word')}
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
              />
              <input
                                  value={newDef}
                onChange={(e) => setNewDef(e.target.value)}
                placeholder={t('form.translation')}
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
              />
              <button
                onClick={handleAddWord}
                className="rounded-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity transition-colors"
              >
                +
              </button>
            </div>
            <input
                              value={newExample}
              onChange={(e) => setNewExample(e.target.value)}
              placeholder={t('form.examplePlaceholder')}
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm italic text-gray-500 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
            />
          </div>
        </section>
      </div>
    </Layout>
  )
}

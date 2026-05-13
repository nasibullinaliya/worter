import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getSet, updateSet, addWords, updateWord, deleteWord, type SetDetailDto, type WordDto } from '../api/sets'
import { parseImportText } from '../utils/importParser'
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
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTerm, setEditTerm] = useState('')
  const [editDef, setEditDef] = useState('')

  const [newTerm, setNewTerm] = useState('')
  const [newDef, setNewDef] = useState('')

  const [importText, setImportText] = useState('')
  const [importMode, setImportMode] = useState(false)
  const [separator, setSeparator] = useState('-')

  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    getSet(id).then((s) => {
      if (!s.isOwner) { navigate(`/sets/${id}`); return }
      setSet(s)
      setTitle(s.title)
      setDescription(s.description ?? '')
      setIsPublic(s.isPublic)
    }).catch(() => setError(t('form.notFoundError')))
     .finally(() => setLoading(false))
  }, [id])

  const handleSaveSettings = async () => {
    if (!set || !title.trim()) return
    setSaving(true)
    try {
      await updateSet(set.id, { title: title.trim(), description: description.trim() || undefined, isPublic })
      setSet((prev) => prev ? { ...prev, title: title.trim(), description: description.trim() || null, isPublic } : prev)
    } catch { setError(t('form.saveError')) }
    finally { setSaving(false) }
  }

  const startEdit = (word: WordDto) => {
    setEditingId(word.id)
    setEditTerm(word.term)
    setEditDef(word.definition)
  }

  const saveEdit = async (wordId: string) => {
    if (!editTerm.trim() || !editDef.trim()) return
    const updated = await updateWord(wordId, { term: editTerm.trim(), definition: editDef.trim() })
    setSet((prev) => prev ? { ...prev, words: prev.words.map((w) => w.id === wordId ? updated : w) } : prev)
    setEditingId(null)
  }

  const handleDeleteWord = async (wordId: string) => {
    await deleteWord(wordId)
    setSet((prev) => prev ? { ...prev, words: prev.words.filter((w) => w.id !== wordId) } : prev)
  }

  const handleAddWord = async () => {
    if (!set || !newTerm.trim() || !newDef.trim()) return
    const added = await addWords(set.id, [{ term: newTerm.trim(), definition: newDef.trim() }])
    setSet((prev) => prev ? { ...prev, words: [...prev.words, ...added] } : prev)
    setNewTerm('')
    setNewDef('')
  }

  const handleImport = async () => {
    if (!set || !importText.trim()) return
    const words = parseImportText(importText, separator)
    if (words.length === 0) { setError(t('form.notRecognized')); return }
    const added = await addWords(set.id, words)
    setSet((prev) => prev ? { ...prev, words: [...prev.words, ...added] } : prev)
    setImportText('')
    setImportMode(false)
  }

  if (loading) return (
    <Layout>
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    </Layout>
  )

  if (!set) return <Layout><p className="text-red-500">{error}</p></Layout>

  return (
    <Layout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{t('form.editing')}</h2>
          <button onClick={() => navigate(`/sets/${set.id}`)} className="text-sm text-gray-500 hover:text-gray-700">
            {t('form.backToSet')}
          </button>
        </div>

        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">{t('form.setSettings')}</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('form.title')}</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('form.description')}</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsPublic(!isPublic)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPublic ? 'bg-indigo-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-sm text-gray-700">
                {isPublic ? t('common.public') : t('common.private')}
              </span>
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? t('common.saving') : t('form.saveSettings')}
            </button>
          </div>
        </section>

        <section className="rounded-xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h3 className="font-semibold text-gray-900">
              {t('form.wordsSection')} ({set.words.length})
            </h3>
            <button
              onClick={() => setImportMode(!importMode)}
              className="text-sm text-indigo-600 hover:underline"
            >
              {importMode ? t('form.hideImport') : t('form.showImport')}
            </button>
          </div>

          {importMode && (
            <div className="border-b p-5">
              {/* Separator row */}
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm text-gray-500">{t('form.separator')}:</span>
                <input
                  type="text"
                  value={separator}
                  onChange={(e) => setSeparator(e.target.value)}
                  className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-center font-mono text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={6}
                placeholder={`apple ${separator || '-'} яблоко\nbanana ${separator || '-'} банан`}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              {importText.trim() && (
                <p className="mt-1 text-xs text-gray-500">
                  {t('form.recognized')} {parseImportText(importText, separator).length} {wl(parseImportText(importText, separator).length)}
                </p>
              )}
              <button
                onClick={handleImport}
                className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                {t('common.add')}
              </button>
            </div>
          )}

          {set.words.map((word, i) => (
            <div key={word.id} className={`px-5 py-3 ${i !== set.words.length - 1 ? 'border-b' : ''}`}>
              {editingId === word.id ? (
                <div className="flex items-center gap-2">
                  <input
                    value={editTerm}
                    onChange={(e) => setEditTerm(e.target.value)}
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
                  />
                  <input
                    value={editDef}
                    onChange={(e) => setEditDef(e.target.value)}
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
                  />
                  <button onClick={() => saveEdit(word.id)} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                    {t('common.save')}
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-sm text-gray-500 hover:text-gray-700">
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <span className="w-6 shrink-0 text-sm text-gray-400">{i + 1}</span>
                  <span className="flex-1 font-medium text-gray-900">{word.term}</span>
                  <span className="flex-1 text-sm text-gray-600">{word.definition}</span>
                  <div className="flex gap-3 shrink-0">
                    <button onClick={() => startEdit(word)} className="text-xs text-gray-500 hover:text-indigo-600">
                      {t('common.edit')}
                    </button>
                    <button onClick={() => handleDeleteWord(word.id)} className="text-xs text-red-400 hover:text-red-600">
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="border-t p-5">
            <p className="mb-2 text-sm font-medium text-gray-700">{t('form.addWord')}</p>
            <div className="flex gap-2">
              <input
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                placeholder={t('form.word')}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
              />
              <input
                value={newDef}
                onChange={(e) => setNewDef(e.target.value)}
                placeholder={t('form.translation')}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
              />
              <button
                onClick={handleAddWord}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                +
              </button>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  )
}

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getSet, deleteSet, cloneSet, type SetDetailDto } from '../api/sets'
import { Layout } from '../components/Layout'
import { SpeakButton } from '../components/SpeakButton'
import { useLang } from '../context/LangContext'

export default function SetDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, wl } = useLang()
  const [set, setSet] = useState<SetDetailDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cloneStatus, setCloneStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    if (!id) return
    getSet(id)
      .then(setSet)
      .catch(() => setError(t('set.notFound')))
      .finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    if (!set || !confirm(t('dashboard.deleteConfirm'))) return
    await deleteSet(set.id)
    navigate('/dashboard')
  }

  const handleClone = async () => {
    if (!set) return
    setCloneStatus('saving')
    try {
      await cloneSet(set.id)
      setCloneStatus('saved')
    } catch (err: any) {
      const msg = err.response?.data?.message ?? ''
      if (msg.includes('уже добавлен')) setCloneStatus('saved')
      else setCloneStatus('idle')
    }
  }

  if (loading) return (
    <Layout>
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    </Layout>
  )

  if (error || !set) return (
    <Layout>
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        {error || t('common.notFound')}
      </div>
    </Layout>
  )

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-gray-900">{set.title}</h2>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              set.isPublic ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {set.isPublic ? t('set.publicBadge') : t('set.privateBadge')}
            </span>
          </div>
          {set.description && (
            <p className="mt-1 text-sm text-gray-500">{set.description}</p>
          )}
          <p className="mt-1 text-sm text-gray-400">{set.words.length} {wl(set.words.length)}</p>
        </div>

        <div className="flex gap-2">
          {!set.isOwner && (
            <button
              onClick={handleClone}
              disabled={cloneStatus !== 'idle'}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                cloneStatus === 'saved'
                  ? 'bg-green-100 text-green-700 cursor-default'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
              }`}
            >
              {cloneStatus === 'saved'
                ? t('set.added')
                : cloneStatus === 'saving'
                ? '...'
                : t('set.addToMine')}
            </button>
          )}

          {set.isOwner && (
            <>
              <Link
                to={`/sets/${set.id}/edit`}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                {t('set.editSet')}
              </Link>
              <button
                onClick={handleDelete}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                {t('common.delete')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Study buttons */}
      {(set.isOwner || set.isSaved) && set.words.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-3">
          <Link
            to={`/sets/${set.id}/flashcards`}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {t('set.flashcards')}
          </Link>
          <Link
            to={`/sets/${set.id}/test`}
            className="rounded-lg border border-indigo-600 px-5 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
          >
            {t('set.study')}
          </Link>
          <Link
            to={`/sets/${set.id}/quiz`}
            className="rounded-lg border border-gray-400 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            {t('quiz.quizBtn')}
          </Link>
        </div>
      )}

      {/* Word list */}
      {set.words.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center">
          <p className="text-gray-500">{t('set.noWords')}</p>
          {set.isOwner && (
            <Link to={`/sets/${set.id}/edit`} className="mt-2 inline-block text-sm text-indigo-600 hover:underline">
              {t('set.addWords')}
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          {set.words.map((word, i) => (
            <div
              key={word.id}
              className={`flex items-center gap-4 px-5 py-3 ${i !== set.words.length - 1 ? 'border-b' : ''}`}
            >
              <span className="w-6 shrink-0 text-sm text-gray-400">{i + 1}</span>
              <span className="flex w-1/2 items-center gap-1 font-medium text-gray-900">
                {word.term}
                <SpeakButton text={word.term} lang={set.language} />
              </span>
              <span className="w-1/2 text-sm text-gray-600">{word.definition}</span>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}

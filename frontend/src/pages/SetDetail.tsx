import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getSet, deleteSet, cloneSet, uncloneSet, type SetDetailDto } from '../api/sets'
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
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (!id) return
    getSet(id)
      .then((s) => {
        setSet(s)
        if (s.isSaved) setCloneStatus('saved')
      })
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
      setSet({ ...set, isSaved: true })
    } catch (err: any) {
      const msg = err.response?.data?.message ?? ''
      if (msg.includes('уже добавлен')) {
        setCloneStatus('saved')
        setSet({ ...set, isSaved: true })
      } else {
        setCloneStatus('idle')
      }
    }
  }

  const handleUnclone = async () => {
    if (!set) return
    setRemoving(true)
    try {
      await uncloneSet(set.id)
      navigate('/dashboard')
    } catch {
      setRemoving(false)
    }
  }

  if (loading) return (
    <Layout>
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
      </div>
    </Layout>
  )

  if (error || !set) return (
    <Layout>
      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
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
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                set.isPublic
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {set.isPublic ? t('set.publicBadge') : t('set.privateBadge')}
            </span>
          </div>
          {set.description && (
            <p className="mt-1 text-sm text-gray-500">{set.description}</p>
          )}
          {!set.isOwner && set.authorName && (
            <p className="mt-1 text-xs text-gray-400">
              {t('dashboard.by')} <span className="font-medium">{set.authorName}</span>
            </p>
          )}
          <p className="mt-1 text-sm text-gray-400">
            {set.words.length} {wl(set.words.length)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!set.isOwner && cloneStatus !== 'saved' && (
            <button
              onClick={handleClone}
              disabled={cloneStatus === 'saving'}
              className="rounded-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 transition-colors"
            >
              {cloneStatus === 'saving' ? '...' : t('set.addToMine')}
            </button>
          )}
          {!set.isOwner && cloneStatus === 'saved' && (
            <button
              onClick={handleUnclone}
              disabled={removing}
              className="rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {removing ? '...' : t('set.removeFromMine')}
            </button>
          )}

          {set.isOwner && (
            <>
              <Link
                to={`/sets/${set.id}/edit`}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {t('set.editSet')}
              </Link>
              <button
                onClick={handleDelete}
                className="rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
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
            className="rounded-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity transition-colors"
          >
            {t('set.flashcards')}
          </Link>
          <Link
            to={`/sets/${set.id}/test`}
            className="rounded-full border-2 border-[#6366F1] px-5 py-2 text-sm font-semibold text-[#4F46E5] hover:bg-indigo-50 transition-colors"
          >
            {t('set.study')}
          </Link>
          <Link
            to={`/sets/${set.id}/quiz`}
            className="rounded-full border-2 border-[#6366F1] px-5 py-2 text-sm font-semibold text-[#4F46E5] hover:bg-indigo-50 transition-colors"
          >
            {t('quiz.quizBtn')}
          </Link>
        </div>
      )}

      {/* Word list */}
      {set.words.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-12 text-center">
          <p className="text-gray-400">{t('set.noWords')}</p>
          {set.isOwner && (
            <Link
              to={`/sets/${set.id}/edit`}
              className="mt-2 inline-block text-sm text-violet-600 hover:underline"
            >
              {t('set.addWords')}
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {set.words.map((word, i) => (
            <div
              key={word.id}
              className={`flex items-center gap-4 px-5 py-3 ${
                i !== set.words.length - 1 ? 'border-b border-gray-50' : ''
              }`}
            >
              <span className="w-6 shrink-0 text-sm text-gray-300">{i + 1}</span>
              <span className="flex w-1/2 items-center gap-1 font-medium text-gray-900">
                {word.term}
                <SpeakButton text={word.term} lang={set.language} />
              </span>
              <span className="w-1/2 text-sm text-gray-500">{word.definition}</span>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}

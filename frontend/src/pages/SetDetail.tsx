import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getSet, deleteSet, cloneSet, uncloneSet, generateText, type SetDetailDto } from '../api/sets'
import { getStudyHistory, getAllWords, type SetStudyLogDto, type AllWordsItemDto } from '../api/progress'
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
  const [history, setHistory] = useState<SetStudyLogDto[] | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [allUserWords, setAllUserWords] = useState<AllWordsItemDto[]>([])
  const [genOpen, setGenOpen] = useState(false)
  const [genLevel, setGenLevel] = useState('A2')
  const [genCount, setGenCount] = useState(6)
  const [genLoading, setGenLoading] = useState(false)
  const [genText, setGenText] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getSet(id)
      .then((s) => {
        setSet(s)
        if (s.isSaved) setCloneStatus('saved')
      })
      .catch(() => setError(t('set.notFound')))
      .finally(() => setLoading(false))
    getAllWords().then(setAllUserWords).catch(() => {})
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

  const handleToggleHistory = async () => {
    if (!id) return
    if (!historyOpen && history === null) {
      setHistoryLoading(true)
      try {
        const data = await getStudyHistory(id)
        setHistory(data)
      } catch {
        setHistory([])
      } finally {
        setHistoryLoading(false)
      }
    }
    setHistoryOpen((prev) => !prev)
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
            to={`/sets/${set.id}/study`}
            className="rounded-full border-2 border-[#6366F1] px-5 py-2 text-sm font-semibold text-[#4F46E5] hover:bg-indigo-50 transition-colors"
          >
            {t('set.study')}
          </Link>
          <Link
            to={`/sets/${set.id}/test`}
            className="rounded-full border-2 border-[#6366F1] px-5 py-2 text-sm font-semibold text-[#4F46E5] hover:bg-indigo-50 transition-colors"
          >
            {t('quiz.quizBtn')}
          </Link>
          <button
            onClick={() => { setGenText(null); setGenOpen(true) }}
            className="rounded-full border-2 border-violet-300 px-5 py-2 text-sm font-semibold text-violet-600 hover:bg-violet-50 transition-colors"
          >
            ✨ {t('set.generateText')}
          </button>
        </div>
      )}

      {/* Generate text modal */}
      {genOpen && set && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setGenOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">✨ {t('set.generateText')}</h3>
              <button onClick={() => setGenOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            {!genText ? (
              <>
                <div className="mb-4 flex gap-4">
                  <div className="flex-1">
                    <p className="mb-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('set.genLevel')}</p>
                    <div className="flex gap-2">
                      {['A1', 'A2', 'B1', 'B2'].map((l) => (
                        <button
                          key={l}
                          onClick={() => setGenLevel(l)}
                          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
                            genLevel === l
                              ? 'bg-violet-600 text-white'
                              : 'border border-gray-200 text-gray-600 hover:border-violet-300'
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('set.genSentences')}</p>
                    <div className="flex gap-2">
                      {[4, 6, 8, 10].map((n) => (
                        <button
                          key={n}
                          onClick={() => setGenCount(n)}
                          className={`w-10 rounded-xl py-2 text-sm font-semibold transition-colors ${
                            genCount === n
                              ? 'bg-violet-600 text-white'
                              : 'border border-gray-200 text-gray-600 hover:border-violet-300'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    setGenLoading(true)
                    try {
                      const text = await generateText(set.id, genLevel, genCount)
                      setGenText(text)
                    } finally {
                      setGenLoading(false)
                    }
                  }}
                  disabled={genLoading}
                  className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition-colors"
                >
                  {genLoading ? t('set.genLoading') : t('set.genGenerate')}
                </button>
              </>
            ) : (
              <>
                <div className="mb-4 max-h-72 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm leading-relaxed text-gray-800"
                  dangerouslySetInnerHTML={{
                    __html: genText
                      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-violet-700">$1</strong>')
                      .replace(/\n/g, '<br/>')
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setGenText(null)}
                    className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:border-violet-300 transition-colors"
                  >
                    ← {t('set.genBack')}
                  </button>
                  <button
                    onClick={async () => {
                      setGenText(null)
                      setGenLoading(true)
                      try {
                        const text = await generateText(set.id, genLevel, genCount)
                        setGenText(text)
                      } finally {
                        setGenLoading(false)
                      }
                    }}
                    disabled={genLoading}
                    className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition-colors"
                  >
                    {genLoading ? t('set.genLoading') : '↻ ' + t('set.genRegenerate')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Word list */}
      {(() => {
        // terms appearing >1 time within this set
        const termCount = new Map<string, number>()
        for (const w of set.words) {
          const key = w.term.toLowerCase().trim()
          termCount.set(key, (termCount.get(key) ?? 0) + 1)
        }
        const intraDups = new Set([...termCount.entries()].filter(([, c]) => c > 1).map(([k]) => k))

        // terms present in other sets
        const crossMap = new Map<string, string[]>()
        for (const w of allUserWords) {
          if (w.setId === set.id) continue
          const key = w.term.toLowerCase().trim()
          if (!crossMap.has(key)) crossMap.set(key, [])
          if (!crossMap.get(key)!.includes(w.setTitle)) crossMap.get(key)!.push(w.setTitle)
        }

        return set.words.length === 0 ? null : (
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {set.words.map((word, i) => {
              const key = word.term.toLowerCase().trim()
              const isDup = intraDups.has(key)
              const otherSets = crossMap.get(key) ?? []
              return (
                <div
                  key={word.id}
                  className={`flex items-center gap-4 px-5 py-3 ${
                    i !== set.words.length - 1 ? 'border-b border-gray-50' : ''
                  }`}
                >
                  <span className="w-6 shrink-0 text-sm text-gray-300">{i + 1}</span>
                  <div className="flex w-1/2 min-w-0 flex-col">
                    <span className="flex items-center gap-1.5 font-medium text-gray-900">
                      {word.term}
                      <SpeakButton text={word.term} lang={set.language} />
                      {isDup && (
                        <span className="group relative cursor-default">
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                            ×2
                          </span>
                          <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs text-gray-500 shadow-md group-hover:block">
                            {t('set.dupInSet')}
                          </span>
                        </span>
                      )}
                      {otherSets.length > 0 && (
                        <span className="group relative cursor-default">
                          <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                            {otherSets.length === 1 ? otherSets[0] : `${otherSets.length} sets`}
                          </span>
                          <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs text-gray-500 shadow-md group-hover:block">
                            <span className="block font-semibold text-gray-700 mb-1">{t('set.inOtherSets')}:</span>
                            {otherSets.map((s) => <span key={s} className="block">{s}</span>)}
                          </span>
                        </span>
                      )}
                    </span>
                    {word.example && (
                      <span className="mt-0.5 text-xs italic text-gray-400">{word.example}</span>
                    )}
                  </div>
                  <span className="w-1/2 text-sm text-gray-500">{word.definition}</span>
                </div>
              )
            })}
          </div>
        )
      })()}
      {set.words.length === 0 && (
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
      )}
      {/* Study history */}
      {(set.isOwner || set.isSaved) && (
        <div className="mt-6">
          <button
            onClick={handleToggleHistory}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
          >
            <span className={`inline-block transition-transform ${historyOpen ? 'rotate-90' : ''}`}>▶</span>
            Study history
          </button>

          {historyOpen && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              {historyLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
                </div>
              ) : !history || history.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-400">No sessions recorded yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-400">
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Stage</th>
                      <th className="px-5 py-3">Next review</th>
                      <th className="px-5 py-3">Known</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((log, i) => {
                      const studiedAt = new Date(log.studiedAt)
                      const nextReview = log.nextReviewAtAfter ? new Date(log.nextReviewAtAfter) : null
                      return (
                        <tr
                          key={i}
                          className={`${i !== history.length - 1 ? 'border-b border-gray-50' : ''}`}
                        >
                          <td className="px-5 py-3 text-gray-700">
                            {studiedAt.toLocaleDateString()} {studiedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-5 py-3 text-gray-700">
                            {log.stageBefore} → {log.stageAfter}
                          </td>
                          <td className="px-5 py-3 text-gray-700">
                            {nextReview
                              ? nextReview.toLocaleDateString()
                              : <span className="text-green-600 font-medium">Complete</span>}
                          </td>
                          <td className="px-5 py-3 text-gray-700">
                            {log.knownCount}/{log.totalWords}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}

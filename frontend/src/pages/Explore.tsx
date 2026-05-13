import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { exploreSearch, type ExploreItemDto } from '../api/explore'
import { cloneSet } from '../api/sets'
import { Layout } from '../components/Layout'
import { useLang } from '../context/LangContext'

export default function Explore() {
  const { t, wl } = useLang()
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<ExploreItemDto[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [savingId, setSavingId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pageSize = 20
  const totalPages = Math.ceil(totalCount / pageSize)

  const doSearch = (q: string, p: number) => {
    setLoading(true)
    exploreSearch(q, p)
      .then((res) => {
        setItems(res.items)
        setTotalCount(res.totalCount)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      doSearch(query, 1)
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  useEffect(() => {
    if (page > 1) doSearch(query, page)
  }, [page])

  const handleSave = async (id: string) => {
    setSavingId(id)
    try {
      await cloneSet(id)
      setSavedIds((prev) => new Set([...prev, id]))
    } catch (err: any) {
      const msg = err.response?.data?.message ?? ''
      if (msg.includes('уже добавлен')) setSavedIds((prev) => new Set([...prev, id]))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <Layout>
      <div className="mb-6">
        <h2 className="mb-1 text-2xl font-bold text-gray-900">{t('explore.title')}</h2>
        <p className="text-sm text-gray-500">{t('explore.subtitle')}</p>
      </div>

      <div className="relative mb-6">
        <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('explore.searchPlaceholder')}
          className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        {loading && (
          <span className="absolute inset-y-0 right-3 flex items-center">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </span>
        )}
      </div>

      {!loading && (
        <p className="mb-4 text-sm text-gray-500">
          {totalCount > 0
            ? `${t('explore.found')} ${totalCount}`
            : query
            ? t('explore.notFound')
            : t('explore.noPublic')}
        </p>
      )}

      {items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const isSaved = savedIds.has(item.id)
            return (
              <div
                key={item.id}
                className="flex flex-col rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-2 flex-1">
                  <Link
                    to={`/sets/${item.id}`}
                    className="block font-semibold text-gray-900 hover:text-indigo-600 line-clamp-2 mb-1"
                  >
                    {item.title}
                  </Link>
                  {item.description && (
                    <p className="text-sm text-gray-500 line-clamp-2">{item.description}</p>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-gray-400">
                      {item.authorName} · {item.wordCount} {wl(item.wordCount)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSave(item.id)}
                    disabled={isSaved || savingId === item.id}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      isSaved
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
                    }`}
                  >
                    {isSaved ? t('explore.added') : savingId === item.id ? '...' : t('explore.add')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            ←
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page + i - 3
            if (p < 1 || p > totalPages) return null
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  p === page
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {p}
              </button>
            )
          })}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}
    </Layout>
  )
}

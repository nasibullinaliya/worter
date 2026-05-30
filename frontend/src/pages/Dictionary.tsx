import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDictionary, type DictionaryFilter, type DictionaryWordDto } from '../api/dictionary'
import { Layout } from '../components/Layout'
import { useLang } from '../context/LangContext'

const PAGE_SIZE = 30

export default function Dictionary() {
  const { t } = useLang()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filter, setFilter] = useState<DictionaryFilter>('all')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<DictionaryWordDto[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showSet, setShowSet] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  // Reset page when filter changes
  useEffect(() => { setPage(1) }, [filter])

  // Fetch
  useEffect(() => {
    setLoading(true)
    getDictionary({ search: debouncedSearch || undefined, filter, page, pageSize: PAGE_SIZE })
      .then((data) => {
        setItems(data.items)
        setTotalCount(data.totalCount)
      })
      .finally(() => setLoading(false))
  }, [debouncedSearch, filter, page])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('dictionary.title')}</h2>
          {!loading && (
            <p className="mt-0.5 text-xs text-gray-400">
              {t('dictionary.total')}: {totalCount}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowSet((v) => !v)}
          className="self-start sm:self-auto flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {showSet
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              : <><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
            }
          </svg>
          {showSet ? t('dictionary.hideSet') : t('dictionary.showSet')}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('dictionary.search')}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 shadow-sm"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div className="mb-4 flex gap-2">
        {(['all', 'completed', 'incomplete'] as DictionaryFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filter === f
                ? 'border-violet-600 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {f === 'completed' && (
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {f === 'all' && t('dictionary.filterAll')}
            {f === 'completed' && t('dictionary.filterCompleted')}
            {f === 'incomplete' && t('dictionary.filterIncomplete')}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {/* Header */}
        <div className={`grid border-b bg-gray-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 ${showSet ? 'grid-cols-[1fr_1fr_1fr_20px]' : 'grid-cols-[1fr_1fr_20px]'}`}>
          <span>{t('dictionary.colTerm')}</span>
          <span>{t('dictionary.colDefinition')}</span>
          {showSet && <span>{t('dictionary.colSet')}</span>}
          <span />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-400">
            {debouncedSearch ? t('dictionary.empty') : t('dictionary.noWords')}
          </p>
        ) : (
          items.map((word, i) => (
            <div
              key={word.wordId}
              className={`grid items-center gap-4 px-5 py-3 ${showSet ? 'grid-cols-[1fr_1fr_1fr_20px]' : 'grid-cols-[1fr_1fr_20px]'} ${i !== items.length - 1 ? 'border-b border-gray-50' : ''}`}
            >
              <span className="text-sm font-medium text-gray-900">{word.term}</span>
              <span className="text-sm text-gray-500">{word.definition}</span>
              {showSet && (
                <Link
                  to={`/sets/${word.setId}`}
                  className="truncate text-xs text-violet-600 hover:underline"
                >
                  {word.setTitle}
                </Link>
              )}
              <span className="flex items-center justify-center w-5">
                {word.isFinalCompleted && (
                  <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            ←
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce<(number | '…')[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…')
              acc.push(p)
              return acc
            }, [])
            .map((p, i) =>
              p === '…' ? (
                <span key={`ellipsis-${i}`} className="px-1 text-sm text-gray-400">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={`min-w-[32px] rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors ${
                    p === page
                      ? 'border-violet-600 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              )
            )}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}
    </Layout>
  )
}

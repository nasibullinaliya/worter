import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getSet, type SetDetailDto } from '../api/sets'
import { recordSession } from '../api/progress'
import { TestRunner } from '../components/TestRunner'
import { Layout } from '../components/Layout'
import type { TestWord } from '../utils/testEngine'

const MIN_WORDS = 2

export default function Test() {
  const { id } = useParams<{ id: string }>()
  const [set, setSet] = useState<SetDetailDto | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getSet(id)
      .then(setSet)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <Layout>
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
      </div>
    </Layout>
  )

  if (!set) return <Layout><p className="text-gray-500">Набор не найден.</p></Layout>

  if (set.words.length < MIN_WORDS) return (
    <Layout>
      <div className="mx-auto max-w-md py-12 text-center">
        <p className="mb-4 text-gray-500">Для теста нужно минимум {MIN_WORDS} слова.</p>
      </div>
    </Layout>
  )

  const words: TestWord[] = set.words.map((w) => ({
    wordId: w.id,
    setId: set.id,
    term: w.term,
    definition: w.definition,
  }))

  const handleFinish = async (wordResults: { wordId: string; errorCount: number }[]) => {
    try {
      return await recordSession(id!, wordResults)
    } catch {
      return null
    }
  }

  return (
    <Layout>
      <TestRunner
        words={words}
        backHref={`/sets/${id}`}
        backLabel={set.title}
        onFinish={handleFinish}
        lang={set.language}
      />
    </Layout>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getSet, type SetDetailDto } from '../api/sets'
import { recordWordProgress } from '../api/progress'
import { QuizRunner } from '../components/QuizRunner'
import { Layout } from '../components/Layout'
import { useLang } from '../context/LangContext'
import type { TestWord } from '../utils/testEngine'

export default function Quiz() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useLang()
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    </Layout>
  )

  if (!set) return (
    <Layout>
      <p className="text-gray-500">{t('set.notFound')}</p>
    </Layout>
  )

  if (set.words.length < 1) return (
    <Layout>
      <div className="mx-auto max-w-md py-12 text-center">
        <p className="text-gray-500">{t('set.noWords')}</p>
      </div>
    </Layout>
  )

  const words: TestWord[] = set.words.map((w) => ({
    wordId: w.id,
    setId: set.id,
    term: w.term,
    definition: w.definition,
  }))

  const handleComplete = (knownWordIds: string[], unknownWordIds: string[]) => {
    recordWordProgress(knownWordIds, unknownWordIds).catch(() => {})
  }

  return (
    <Layout>
      <QuizRunner
        words={words}
        backLabel={`← ${set.title}`}
        onBack={() => navigate(`/sets/${id}`)}
        onComplete={handleComplete}
      />
    </Layout>
  )
}

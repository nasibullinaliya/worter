import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getSet, getReminders, type SetDetailDto } from '../api/sets'
import { recordSession } from '../api/progress'
import { QuizRunner } from '../components/QuizRunner'
import { Layout } from '../components/Layout'
import { useLang } from '../context/LangContext'
import type { NextSetInfo } from '../components/NextSetButton'
import type { TestWord } from '../utils/testEngine'

function toTestWords(set: SetDetailDto, wordsSubset: SetDetailDto['words']): TestWord[] {
  return wordsSubset.map((w) => ({
    wordId: w.id,
    setId: set.id,
    term: w.term,
    definition: w.definition,
  }))
}

export default function Quiz() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useLang()
  const [searchParams] = useSearchParams()
  const isFinalStage = searchParams.get('final') === '1'

  const [set, setSet] = useState<SetDetailDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [nextSet, setNextSet] = useState<NextSetInfo | undefined>()
  // For final stage: only incomplete words; updated after each partial completion
  const [finalWords, setFinalWords] = useState<TestWord[]>([])

  useEffect(() => {
    if (!id) return
    getSet(id).then((s) => {
      setSet(s)
      if (isFinalStage) {
        // Only include words not yet completed in the final stage
        const incomplete = s.words.filter((w) => !w.isFinalCompleted)
        setFinalWords(toTestWords(s, incomplete))
      }
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <Layout>
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
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

  const allWords = toTestWords(set, set.words)

  const fetchNextSet = async () => {
    try {
      const reminders = await getReminders()
      const first = reminders[0]
      if (first) setNextSet({ setId: first.setId, title: first.title, reviewStage: first.reviewStage })
    } catch { /* non-critical */ }
  }

  // Regular test: record session then fetch next set from plan
  const handleComplete = (knownWordIds: string[], unknownWordIds: string[]) => {
    const wordResults = [
      ...knownWordIds.map((wordId) => ({ wordId, errorCount: 0 })),
      ...unknownWordIds.map((wordId) => ({ wordId, errorCount: 1 })),
    ]
    if (id) recordSession(id, wordResults).then(fetchNextSet).catch(() => {})
  }

  // Final stage: record session with isFinalStage=true, then refresh incomplete words
  const handleFinalFinish = async (knownWordIds: string[], unknownWordIds: string[]) => {
    const wordResults = [
      ...knownWordIds.map((wordId) => ({ wordId, errorCount: 0 })),
      ...unknownWordIds.map((wordId) => ({ wordId, errorCount: 1 })),
    ]
    try {
      const result = await recordSession(id!, wordResults, true)
      if (result?.reviewStage !== 6) {
        // Partial completion — refresh set to get updated isFinalCompleted per word
        const updatedSet = await getSet(id!)
        setSet(updatedSet)
        const remaining = updatedSet.words.filter((w) => !w.isFinalCompleted)
        setFinalWords(toTestWords(updatedSet, remaining))
      }
      await fetchNextSet()
      return result
    } catch {
      return null
    }
  }

  return (
    <Layout>
      <QuizRunner
        words={isFinalStage ? finalWords : allWords}
        backLabel={`← ${set.title}`}
        onBack={() => navigate(`/sets/${id}`)}
        onComplete={isFinalStage ? undefined : handleComplete}
        isFinalStage={isFinalStage}
        onFinalFinish={isFinalStage ? handleFinalFinish : undefined}
        nextSet={nextSet}
        defaultSessionMode="test"
      />
    </Layout>
  )
}

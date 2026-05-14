import client from './client'

export interface SetProgressDto {
  setId: string
  firstStudiedAt: string
  lastStudiedAt: string
  nextReviewAt: string | null
  reviewStage: number
  knownCount: number
  totalWords: number
}

export interface WordProgressDto {
  wordId: string
  term: string
  definition: string
  knownCount: number
  unknownCount: number
  lastSeenAt: string
}

export interface ProgressDetailDto {
  setProgress: SetProgressDto | null
  wordItems: WordProgressDto[]
}

export interface AllWordsItemDto {
  wordId: string
  term: string
  definition: string
  setId: string
  setTitle: string
}

export const recordSession = (setId: string, knownWordIds: string[]) =>
  client.post<SetProgressDto>(`/api/progress/${setId}`, { knownWordIds }).then((r) => r.data)

export const getProgress = (setId: string) =>
  client.get<ProgressDetailDto>(`/api/progress/${setId}`).then((r) => r.data)

/** Record known/unknown word-level progress without SRS (multi-set sessions, quiz) */
export const recordWordProgress = (knownWordIds: string[], unknownWordIds: string[]) =>
  client.post('/api/progress/words', { knownWordIds, unknownWordIds })

/** Get N words with lowest known-rate from the given sets */
export const getWeakestWords = (setIds: string[], count: number) =>
  client
    .get<AllWordsItemDto[]>('/api/progress/weakest-words', {
      params: { setIds: setIds.join(','), count },
    })
    .then((r) => r.data)

export const getAllWords = () =>
  client.get<AllWordsItemDto[]>('/api/sets/all-words').then((r) => r.data)

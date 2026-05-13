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

export const getAllWords = () =>
  client.get<AllWordsItemDto[]>('/api/sets/all-words').then((r) => r.data)

import client from './client'

export interface SetProgressDto {
  setId: string
  firstStudiedAt: string
  lastStudiedAt: string
  nextReviewAt: string | null
  reviewStage: number
  knownCount: number
  totalWords: number
  isFinalStageFailed: boolean
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

export interface WordSessionResult {
  wordId: string
  errorCount: number
}

export const recordSession = (setId: string, wordResults: WordSessionResult[], isFinalStage = false) =>
  client.post<SetProgressDto>(`/api/progress/${setId}`, { wordResults, isFinalStage }).then((r) => r.data)

export const getProgress = (setId: string) =>
  client.get<ProgressDetailDto>(`/api/progress/${setId}`).then((r) => r.data)

/** Record word-level progress without SRS (multi-set sessions, quiz) */
export const recordWordProgress = (wordResults: WordSessionResult[]) =>
  client.post('/api/progress/words', { wordResults })

/** Get N words with lowest known-rate from the given sets */
export const getWeakestWords = (setIds: string[], count: number) =>
  client
    .get<AllWordsItemDto[]>('/api/progress/weakest-words', {
      params: { setIds: setIds.join(','), count },
    })
    .then((r) => r.data)

export const getAllWords = () =>
  client.get<AllWordsItemDto[]>('/api/sets/all-words').then((r) => r.data)

export interface WeeklyDayDto {
  date: string
  wordCount: number
}

export const getWeeklyProgress = () =>
  client.get<WeeklyDayDto[]>('/api/progress/weekly').then((r) => r.data)

export const getMonthlyProgress = () =>
  client.get<WeeklyDayDto[]>('/api/progress/monthly').then((r) => r.data)

export interface SetStudyLogDto {
  studiedAt: string
  stageBefore: number
  stageAfter: number
  nextReviewAtAfter: string | null
  knownCount: number
  totalWords: number
}

export const getStudyHistory = (setId: string) =>
  client.get<SetStudyLogDto[]>(`/api/progress/${setId}/history`).then((r) => r.data)

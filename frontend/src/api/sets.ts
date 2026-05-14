import client from './client'

export interface WordDto {
  id: string
  term: string
  definition: string
  position: number
}

export interface SetProgressSummary {
  knownCount: number
  totalWords: number
  nextReviewAt: string | null
  reviewStage: number
}

export interface SetSummaryDto {
  id: string
  title: string
  description: string | null
  isPublic: boolean
  isOwner: boolean
  wordCount: number
  createdAt: string
  updatedAt: string
  progress: SetProgressSummary | null
}

export interface SetDetailDto extends Omit<SetSummaryDto, 'wordCount'> {
  isSaved: boolean
  words: WordDto[]
}

export interface ReminderDto {
  setId: string
  title: string
  knownCount: number
  totalWords: number
  nextReviewAt: string
  reviewStage: number
}

export const getSets = () =>
  client.get<SetSummaryDto[]>('/api/sets').then((r) => r.data)

export const getSet = (id: string) =>
  client.get<SetDetailDto>(`/api/sets/${id}`).then((r) => r.data)

export const createSet = (data: { title: string; description?: string; isPublic: boolean }) =>
  client.post<SetSummaryDto>('/api/sets', data).then((r) => r.data)

export const updateSet = (id: string, data: { title: string; description?: string; isPublic: boolean }) =>
  client.put(`/api/sets/${id}`, data)

export const deleteSet = (id: string) =>
  client.delete(`/api/sets/${id}`)

export const cloneSet = (id: string) =>
  client.post(`/api/sets/${id}/clone`)

export const addWords = (setId: string, words: { term: string; definition: string }[]) =>
  client.post<WordDto[]>(`/api/sets/${setId}/words`, { words }).then((r) => r.data)

export const updateWord = (wordId: string, data: { term: string; definition: string }) =>
  client.put<WordDto>(`/api/words/${wordId}`, data).then((r) => r.data)

export const deleteWord = (wordId: string) =>
  client.delete(`/api/words/${wordId}`)

export const getReminders = () =>
  client.get<ReminderDto[]>('/api/reminders').then((r) => r.data)

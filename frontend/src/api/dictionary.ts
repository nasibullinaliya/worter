import client from './client'

export interface DictionaryWordDto {
  wordId: string
  term: string
  definition: string
  example: string | null
  setId: string
  setTitle: string
  isFinalCompleted: boolean
}

export interface DictionaryPageDto {
  items: DictionaryWordDto[]
  totalCount: number
  page: number
  pageSize: number
}

export const getDictionary = (params: { search?: string; page?: number; pageSize?: number }) =>
  client
    .get<DictionaryPageDto>('/api/dictionary', { params })
    .then((r) => r.data)

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

export type DictionaryFilter = 'all' | 'completed' | 'incomplete'

export const getDictionary = (params: { search?: string; filter?: DictionaryFilter; page?: number; pageSize?: number }) =>
  client
    .get<DictionaryPageDto>('/api/dictionary', {
      params: {
        ...params,
        filter: params.filter === 'all' ? undefined : params.filter,
      },
    })
    .then((r) => r.data)

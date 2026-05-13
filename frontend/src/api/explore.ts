import client from './client'

export interface ExploreItemDto {
  id: string
  title: string
  description: string | null
  authorName: string
  wordCount: number
  createdAt: string
}

export interface ExploreResultDto {
  items: ExploreItemDto[]
  totalCount: number
  page: number
  pageSize: number
}

export const exploreSearch = (q: string, page: number) =>
  client
    .get<ExploreResultDto>('/api/explore', { params: { q: q || undefined, page } })
    .then((r) => r.data)

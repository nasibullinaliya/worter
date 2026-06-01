import client from './client'

export interface FolderDto {
  id: string
  name: string
  setCount: number
}

export const getFolders = () =>
  client.get<FolderDto[]>('/api/folders').then((r) => r.data)

export const createFolder = (name: string) =>
  client.post<FolderDto>('/api/folders', { name }).then((r) => r.data)

export const updateFolder = (id: string, name: string) =>
  client.put<FolderDto>(`/api/folders/${id}`, { name }).then((r) => r.data)

export const deleteFolder = (id: string) =>
  client.delete(`/api/folders/${id}`)

export const assignSetToFolder = (folderId: string, setId: string) =>
  client.patch(`/api/folders/${folderId}/sets/${setId}`)

export const removeSetFromFolder = (setId: string) =>
  client.delete(`/api/folders/sets/${setId}`)

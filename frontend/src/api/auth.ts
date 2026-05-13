import client from './client'

export interface UserDto {
  id: string
  email: string
  name: string | null
  createdAt: string
}

export interface AuthResponse {
  token: string
  user: UserDto
}

export const register = (email: string, password: string, name?: string) =>
  client.post<AuthResponse>('/api/auth/register', { email, password, name }).then((r) => r.data)

export const login = (email: string, password: string) =>
  client.post<AuthResponse>('/api/auth/login', { email, password }).then((r) => r.data)

export const getMe = () =>
  client.get<UserDto>('/api/auth/me').then((r) => r.data)

import client from './client'

export interface UserDto {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  createdAt: string
}

export interface AuthResponse {
  token: string
  user: UserDto
}

export const googleLogin = (idToken: string) =>
  client.post<AuthResponse>('/api/auth/google', { idToken }).then((r) => r.data)

export const getMe = () =>
  client.get<UserDto>('/api/auth/me').then((r) => r.data)

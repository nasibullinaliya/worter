import { createContext, useContext, useEffect, useState } from 'react'
import { getMe, login as apiLogin, register as apiRegister, type UserDto } from '../api/auth'

interface AuthContextValue {
  user: UserDto | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setIsLoading(false)
      return
    }
    getMe()
      .then(setUser)
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setIsLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const { token, user } = await apiLogin(email, password)
    localStorage.setItem('token', token)
    setUser(user)
  }

  const register = async (email: string, password: string, name?: string) => {
    const { token, user } = await apiRegister(email, password, name)
    localStorage.setItem('token', token)
    setUser(user)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

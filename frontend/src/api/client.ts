import axios from 'axios'
import { toast } from '../context/ToastContext'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5050',
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Read lang from localStorage so we can show a localised message
// without pulling in the React context.
function errMsg(key: 'network' | 'server'): string {
  const lang = (localStorage.getItem('vocab_lang') ?? 'ru') as 'ru' | 'en' | 'de'
  const msgs = {
    network: { ru: 'Нет соединения с сервером', en: 'No server connection', de: 'Keine Serververbindung' },
    server:  { ru: 'Ошибка сервера',            en: 'Server error',         de: 'Serverfehler' },
  }
  return msgs[key][lang] ?? msgs[key]['ru']
}

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const status: number | undefined = err.response?.status
    if (status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    } else if (!err.response) {
      toast(errMsg('network'))
    } else if (status !== undefined && status >= 500) {
      toast(errMsg('server'))
    }
    return Promise.reject(err)
  },
)

export default client

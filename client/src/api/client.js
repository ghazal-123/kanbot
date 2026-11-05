import axios from 'axios'

export const TOKEN_STORAGE_KEY = 'kanbot_token'

const configuredApiUrl = import.meta.env.VITE_API_URL
  ?.trim()
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '')

export const api = axios.create({
  baseURL: configuredApiUrl ? `${configuredApiUrl}/api` : 'http://localhost:4000/api',
  headers: { 'Content-Type': 'application/json' },
})

let unauthorizedHandler = null

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null
  }
}

api.interceptors.request.use((config) => {
  const token = window.localStorage.getItem(TOKEN_STORAGE_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestPath = error.config?.url?.replace(/^\/+/, '').split('?')[0]
    if (error.response?.status === 401 && requestPath !== 'auth/login') {
      unauthorizedHandler?.()
    }
    return Promise.reject(error)
  },
)

export function getApiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const apiMessage = error?.response?.data?.error?.message
  if (typeof apiMessage === 'string') return apiMessage
  if (axios.isAxiosError(error) && !error.response) {
    return 'Cannot reach the server. Is it running?'
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function getApiFieldErrors(error) {
  const details = error?.response?.data?.error?.details
  if (!Array.isArray(details)) return {}

  return details.reduce((fieldErrors, detail) => {
    const path = Array.isArray(detail?.path) ? detail.path.join('.') : detail?.path
    if (typeof path === 'string' && typeof detail?.message === 'string') {
      fieldErrors[path] = detail.message
    }
    return fieldErrors
  }, {})
}

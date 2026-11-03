import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import {
  api,
  getApiErrorMessage,
  setUnauthorizedHandler,
  TOKEN_STORAGE_KEY,
} from '../api/client'
import AuthContext from './AuthContextValue'

function readStoredToken() {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [initialSession] = useState(() => ({ token: readStoredToken() }))
  const [token, setToken] = useState(initialSession.token)
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(Boolean(initialSession.token))
  const [sessionExpired, setSessionExpired] = useState(false)
  const [authError, setAuthError] = useState('')
  const latestState = useRef(null)
  const initialToken = useRef(initialSession.token)

  const clearSession = useCallback(() => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const saveSession = useCallback((data) => {
    if (!data?.token || !data?.user) {
      throw new Error('The server returned an invalid authentication response.')
    }
    window.localStorage.setItem(TOKEN_STORAGE_KEY, data.token)
    setToken(data.token)
    setUser(data.user)
    setSessionExpired(false)
    setAuthError('')
    return data.user
  }, [])

  const login = useCallback(async ({ email, password }) => {
    const { data } = await api.post('/auth/login', { email, password })
    return saveSession(data)
  }, [saveSession])

  const register = useCallback(async ({ name, email, password }) => {
    const { data } = await api.post('/auth/register', { name, email, password })
    return saveSession(data)
  }, [saveSession])

  const logout = useCallback(() => {
    clearSession()
    setSessionExpired(false)
    setAuthError('')
    navigate('/login', { replace: true })
  }, [clearSession, navigate])

  useEffect(() => {
    latestState.current = {
      navigate,
      location,
      setAuthError,
      setIsLoading,
      setSessionExpired,
      setToken,
      setUser,
    }
    const unregister = setUnauthorizedHandler(() => {
      const current = latestState.current
      if (!current) return

      const { pathname, search, hash } = current.location
      const isGuestPage = pathname === '/login' || pathname === '/register'
      const requestedPath = `${pathname}${search}${hash}`
      const returnPath = new URLSearchParams(search).get('redirect')
      window.localStorage.removeItem(TOKEN_STORAGE_KEY)
      current.setToken(null)
      current.setUser(null)
      current.setIsLoading(false)
      current.setSessionExpired(true)
      current.setAuthError('')
      current.navigate(
        isGuestPage
          ? `/login${returnPath ? `?redirect=${encodeURIComponent(returnPath)}` : ''}`
          : `/login?redirect=${encodeURIComponent(requestedPath)}`,
        { replace: true },
      )
    })

    return unregister
  }, [navigate, location])

  useEffect(() => {
    if (!initialToken.current) {
      setIsLoading(false)
      return undefined
    }

    const controller = new AbortController()
    setIsLoading(true)

    api.get('/auth/me', { signal: controller.signal })
      .then(({ data }) => {
        if (!data?.user) throw new Error('The server returned an invalid user session.')
        setUser(data.user)
        setAuthError('')
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.response?.status === 401) return
        setUser(null)
        setAuthError(getApiErrorMessage(error, 'Unable to verify your session.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [])

  const value = useMemo(() => ({
    token,
    user,
    isLoading,
    sessionExpired,
    authError,
    login,
    register,
    logout,
  }), [token, user, isLoading, sessionExpired, authError, login, register, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

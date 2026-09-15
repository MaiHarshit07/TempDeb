import { useEffect, useMemo, useState } from 'react'
import { AuthContext } from './authContextValue'
import { fetchCurrentUser, loginUser, logoutUser, registerUser, setSessionExpiredHandler } from '../lib/api'

const TOKEN_KEY = 'debate_token'
const USER_CACHE_KEY = 'debate_user_cache'

function readTokenExpiry(token) {
  try {
    const payload = JSON.parse(window.atob(token.split('.')[1]))
    return payload.exp ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_CACHE_KEY)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(USER_CACHE_KEY) || 'null')
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_KEY)
    const expiry = readTokenExpiry(token)
    if (expiry && expiry <= Date.now()) {
      window.setTimeout(() => {
        clearSession()
        setUser(null)
        setLoading(false)
      }, 0)
      return
    }

    const expireSession = () => {
      clearSession()
      setUser(null)
      setError('Your session expired. Please sign in again.')
    }
    setSessionExpiredHandler(token ? expireSession : null)
    const timeout = expiry ? window.setTimeout(expireSession, Math.max(expiry - Date.now(), 0)) : null

    fetchCurrentUser()
      .then((currentUser) => {
        setUser(currentUser)
        sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(currentUser))
      })
      .catch(() => {
        clearSession()
        setUser(null)
      })
      .finally(() => setLoading(false))

    const handleStorage = (event) => {
      if (event.key === TOKEN_KEY && !event.newValue) {
        setUser(null)
        setError('You signed out in another tab.')
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => {
      if (timeout) window.clearTimeout(timeout)
      window.removeEventListener('storage', handleStorage)
      setSessionExpiredHandler(null)
    }
  }, [])

  const login = async (payload) => {
    setError('')
    try {
      const result = await loginUser(payload)
      sessionStorage.setItem(TOKEN_KEY, result.token)
      sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(result.user))
      setUser(result.user)
      return result.user
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Unable to sign in.'
      setError(message)
      throw requestError
    }
  }

  const register = async (payload) => {
    setError('')
    try {
      const result = await registerUser(payload)
      sessionStorage.setItem(TOKEN_KEY, result.token)
      sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(result.user))
      setUser(result.user)
      return result.user
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Unable to create account.'
      setError(message)
      throw requestError
    }
  }

  const logout = async () => {
    try {
      await logoutUser()
    } catch {
      // Clear the local session even if the network request cannot complete.
    }
    clearSession()
    setUser(null)
    setError('')
  }

  const value = useMemo(() => ({ user, loading, error, login, register, logout }), [user, loading, error])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}


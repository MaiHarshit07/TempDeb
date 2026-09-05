import { useEffect, useMemo, useState } from 'react'
import { AuthContext } from './authContextValue'
import { fetchCurrentUser, loginUser, registerUser } from '../lib/api'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('debate_token')))
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('debate_token')
    if (!token) {
      return
    }

    fetchCurrentUser()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('debate_token')
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (payload) => {
    setError('')
    try {
      const result = await loginUser(payload)
      localStorage.setItem('debate_token', result.token)
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
      localStorage.setItem('debate_token', result.token)
      setUser(result.user)
      return result.user
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Unable to create account.'
      setError(message)
      throw requestError
    }
  }

  const logout = () => {
    localStorage.removeItem('debate_token')
    setUser(null)
  }

  const value = useMemo(() => ({ user, loading, error, login, register, logout }), [user, loading, error])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}


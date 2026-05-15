import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')  // PROMENJENO: token -> access_token
    if (token) {
      api.get('/auth/me')
        .then(res => {
          console.log('User data from /me:', res.data)
          setUser(res.data)
        })
        .catch(() => {
          localStorage.removeItem('access_token')
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const register = async (userData) => {
    const response = await api.post('/auth/register', userData)
    return response.data
  }

  const login = async (email, password) => {
    const formData = new FormData()
    formData.append('username', email)
    formData.append('password', password)
    
    const response = await api.post('/auth/login', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    
    console.log('Login response:', response.data)
    
    const { access_token, user } = response.data
    localStorage.setItem('access_token', access_token)  // PROMENJENO: token -> access_token
    setUser(user)
    return response.data
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
import axios from 'axios'

const API_URL = 'https://cargo-backend-mqx7.onrender.com'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor za dodavanje tokena
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      // Opciono: loguj prvih 20 karaktera tokena za proveru
      console.log(`🔑 Token: ${token.substring(0, 20)}...`)
    } else {
      console.warn('⚠️ Nema tokena u localStorage')
    }
    console.log(`📡 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`)
    return config
  },
  (error) => Promise.reject(error)
)

// Interceptor za obradu 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('❌ 401 Unauthorized - brišem token i redirektujem na login')
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Dodatna funkcija za proveru autentifikacije
export const isAuthenticated = () => {
  const token = localStorage.getItem('access_token')
  return !!token && token.length > 0
}

export default api
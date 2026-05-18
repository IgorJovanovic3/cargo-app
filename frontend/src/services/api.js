import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'https://cargo-backend-av58.onrender.com'

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
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Interceptor za obradu 401 - NE RADI LOGOUT ODMAH
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Samo ako nije zahtev za login, radi logout
    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url?.includes('/auth/login')
      if (!isLoginRequest) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('user')
        // Ne radi redirect odmah, samo ako nije WebSocket greška
        if (!error.config?.url?.includes('/ws/')) {
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api
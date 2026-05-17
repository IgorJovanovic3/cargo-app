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
    }
    console.log(`📡 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`)
    return config
  },
  (error) => Promise.reject(error)
)

// Interceptor za obradu 401 - SAMO ZA API POZIVE, NE ZA WEBSOCKET
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // IGNORIŠI 401 ako nema tokena (to je ok)
    if (!localStorage.getItem('access_token')) {
      return Promise.reject(error)
    }
    
    // SAMO ako je 401 i to je baš API poziv (ne WebSocket)
    if (error.response?.status === 401) {
      console.warn('⚠️ 401 Unauthorized - čekam 2 sekunde pre logout-a')
      
      // Ne radi logout odmah! Sačekaj malo da vidiš da li je stvarno potrebno
      setTimeout(() => {
        // Proveri da li i dalje ima token (možda je već osvežen)
        if (localStorage.getItem('access_token')) {
          console.log('✅ Token još uvek postoji, ne radim logout')
          return
        }
        
        // Tek onda logout
        console.error('❌ Logout zbog 401')
        localStorage.removeItem('access_token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }, 2000)
    }
    
    return Promise.reject(error)
  }
)

export default api
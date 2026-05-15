import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Greška pri prijavi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page" style={{
  background: 'rgba(255,255,255,0.95)',
  borderRadius: '20px',
  padding: '2rem',
  width: '100%',
  maxWidth: '450px',
  backdropFilter: 'blur(10px)'
}}>
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        borderRadius: '20px',
        padding: '2rem',
        width: '100%',
        maxWidth: '450px',
        backdropFilter: 'blur(10px)'
      }}>
        <h1 style={{ textAlign: 'center', marginBottom: '1rem' }}>CargoApp</h1>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Šifra</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Prijavljivanje...' : 'Prijavi se'}
          </button>
        </form>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/forgot-password">Zaboravili ste lozinku?</Link>
        </p>
        <p>
          Nemate nalog? <Link to="/register">Registrujte se</Link>
        </p>
      </div>
    </div>
  )
}

export default Login
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, demo } = useAuth()
  const navigate = useNavigate()

  const enterDemo = async (role) => {
    setError('')
    setLoading(true)
    try {
      await login(demo.accounts.find(account => account.role === role).email, demo.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Demo login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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
        {demo?.enabled && (
          <section style={{ padding: '1rem', background: '#eef2ff', borderRadius: '12px', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', margin: '0 0 .5rem' }}>Try the courier workflow</h2>
            <p style={{ fontSize: '.9rem', marginBottom: '.8rem' }}>Choose a role. No registration required.</p>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              <button type="button" disabled={loading} onClick={() => enterDemo('client')}>Try as Client</button>
              <button type="button" disabled={loading} onClick={() => enterDemo('driver')}>Try as Driver</button>
            </div>
            <details style={{ marginTop: '.8rem', fontSize: '.85rem' }}>
              <summary>Demo login details</summary>
              <p>Client: {demo.accounts.find(account => account.role === 'client').email}<br />Driver: {demo.accounts.find(account => account.role === 'driver').email}<br />Password: {demo.password}</p>
            </details>
          </section>
        )}
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
        {!demo?.enabled && <p style={{ marginTop: '1rem' }}>
          <Link to="/forgot-password">Zaboravili ste lozinku?</Link>
        </p>}
        {!demo?.enabled && <p>
          Nemate nalog? <Link to="/register">Registrujte se</Link>
        </p>}
      </div>
    </div>
  )
}

export default Login

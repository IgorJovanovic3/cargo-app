import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import api from '../services/api'

function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      setError('Lozinke se ne poklapaju')
      return
    }
    
    if (password.length < 6) {
      setError('Lozinka mora imati najmanje 6 karaktera')
      return
    }
    
    setError('')
    setLoading(true)

    try {
      await api.post('/auth/reset-password', null, {
        params: { token, new_password: password }
      })
      setMessage('Lozinka je uspešno promenjena!')
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Token je neispravan ili je istekao')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="reset-password-page">
        <h1>Neispravan link</h1>
        <p>Link za resetovanje lozinke nije ispravan.</p>
        <Link to="/login">← Povratak na prijavu</Link>
      </div>
    )
  }

  return (
    <div className="reset-password-page">
      <h1>Resetujte lozinku</h1>
      
      {message && <div className="success" style={{color: 'green', marginBottom: '1rem'}}>{message}</div>}
      {error && <div className="error" style={{color: 'red', marginBottom: '1rem'}}>{error}</div>}
      
      {!message && (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nova lozinka</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label>Potvrdite novu lozinku</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" disabled={loading}>
            {loading ? 'Menjanje...' : 'Promeni lozinku'}
          </button>
        </form>
      )}
    </div>
  )
}

export default ResetPassword
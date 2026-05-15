import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const response = await api.post('/auth/forgot-password', null, {
        params: { email }
      })
      setMessage(response.data.message)
      // Ako dobiješ reset_link, ispiši ga u konzoli za testiranje
      if (response.data.reset_link) {
        console.log('Reset link (samo za testiranje):', response.data.reset_link)
      }
    } catch (err) {
      setError('Došlo je do greške. Pokušajte ponovo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="forgot-password-page">
      <h1>Zaboravili ste lozinku?</h1>
      <p>Unesite vaš email i poslaćemo vam link za resetovanje lozinke.</p>
      
      {message && <div className="success" style={{color: 'green', marginBottom: '1rem'}}>{message}</div>}
      {error && <div className="error" style={{color: 'red', marginBottom: '1rem'}}>{error}</div>}
      
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
        <button type="submit" disabled={loading}>
          {loading ? 'Slanje...' : 'Pošalji link'}
        </button>
      </form>
      
      <p style={{ marginTop: '1rem' }}>
        <Link to="/login">← Povratak na prijavu</Link>
      </p>
    </div>
  )
}

export default ForgotPassword
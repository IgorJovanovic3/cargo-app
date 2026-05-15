import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

function Profile() {
  const { user, login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    is_company: user?.is_company || false,
    company_name: user?.company_name || '',
    company_pib: user?.company_pib || '',
    company_mb: user?.company_mb || '',
    company_address: user?.company_address || '',
    company_tax_number: user?.company_tax_number || ''
  })

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setFormData({ ...formData, [e.target.name]: value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      await api.put('/users/profile', formData)
      setMessage('✅ Podaci su uspešno sačuvani!')
      // Osveži user podatke
      const meRes = await api.get('/auth/me')
      login(meRes.data)
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setMessage('❌ Greška pri čuvanju podataka')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="profile-page">
      <h1>👤 Moj profil</h1>
      
      {message && <div className={message.includes('✅') ? 'success' : 'error'}>{message}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Ime i prezime / Naziv firme</label>
          <input
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Telefon</label>
          <input
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              name="is_company"
              checked={formData.is_company}
              onChange={handleChange}
            />
            🏢 Pravno lice (firma)
          </label>
        </div>
        
        {formData.is_company && (
          <div style={{
            border: '1px solid #667eea',
            borderRadius: '16px',
            padding: '1rem',
            marginTop: '1rem',
            background: '#f8f9ff'
          }}>
            <h4 style={{ marginBottom: '1rem', color: '#667eea' }}>📄 Podaci o firmi</h4>
            
            <div className="form-group">
              <label>PIB</label>
              <input
                name="company_pib"
                value={formData.company_pib}
                onChange={handleChange}
              />
            </div>
            
            <div className="form-group">
              <label>Matični broj</label>
              <input
                name="company_mb"
                value={formData.company_mb}
                onChange={handleChange}
              />
            </div>
            
            <div className="form-group">
              <label>PDV broj (opciono)</label>
              <input
                name="company_tax_number"
                value={formData.company_tax_number}
                onChange={handleChange}
              />
            </div>
            
            <div className="form-group">
              <label>Adresa firme</label>
              <input
                name="company_address"
                value={formData.company_address}
                onChange={handleChange}
              />
            </div>
          </div>
        )}
        
        <button type="submit" disabled={loading}>
          {loading ? 'Čuvanje...' : '💾 Sačuvaj podatke'}
        </button>
      </form>
    </div>
  )
}

export default Profile
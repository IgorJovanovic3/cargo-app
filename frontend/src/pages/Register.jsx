import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    user_type: 'client',
    is_company: false,
    company_name: '',
    company_pib: '',
    company_mb: '',
    company_address: '',
    company_tax_number: ''
  })
  
  const [vehicleInfo, setVehicleInfo] = useState({
    vehicle_type: 'car',
    vehicle_subtype: 'traditional',
    fuel_type: 'petrol',
    vehicle_year: new Date().getFullYear(),
    vehicle_plate: ''
  })
  
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setFormData({ ...formData, [e.target.name]: value })
  }

  const handleVehicleChange = (e) => {
    const value = e.target.value
    setVehicleInfo({ ...vehicleInfo, [e.target.name]: value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      await register(formData)
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.detail || 'Greška pri registraciji')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-page">
      <h1>Registracija</h1>
      {error && <div className="error">{error}</div>}
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
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
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
          <label>Šifra</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Tip naloga</label>
          <select name="user_type" value={formData.user_type} onChange={handleChange}>
            <option value="client">Klijent</option>
            <option value="driver">Vozač</option>
          </select>
        </div>
        
        {/* Opcija za pravno lice */}
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              name="is_company"
              checked={formData.is_company}
              onChange={handleChange}
            />
            🏢 Registracija kao pravno lice (firma)
          </label>
        </div>
        
        {/* Podaci o firmi */}
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
              <label>Naziv firme</label>
              <input
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
              />
            </div>
            
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
              <label>Adresa firme</label>
              <input
                name="company_address"
                value={formData.company_address}
                onChange={handleChange}
              />
            </div>
          </div>
        )}
        
        {/* Podaci o vozilu - samo za vozače */}
        {formData.user_type === 'driver' && (
          <div style={{
            border: '1px solid #667eea',
            borderRadius: '16px',
            padding: '1rem',
            marginTop: '1rem',
            background: '#f8f9ff'
          }}>
            <h4 style={{ marginBottom: '1rem', color: '#667eea' }}>🚗 Podaci o vozilu</h4>
            
            <div className="form-group">
              <label>Tip vozila</label>
              <select name="vehicle_type" value={vehicleInfo.vehicle_type} onChange={handleVehicleChange}>
                <option value="bike">🚲 Bicikl</option>
                <option value="motorcycle">🛵 Motocikl</option>
                <option value="car">🚗 Automobil</option>
                <option value="van">🚐 Kombi</option>
                <option value="truck">🚛 Kamion</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Pogonska grupa</label>
              <select name="vehicle_subtype" value={vehicleInfo.vehicle_subtype} onChange={handleVehicleChange}>
                {vehicleInfo.vehicle_type === 'bike' && (
                  <>
                    <option value="electric">⚡ Električni</option>
                    <option value="traditional">🚲 Tradicionalni</option>
                  </>
                )}
                {vehicleInfo.vehicle_type === 'car' && (
                  <>
                    <option value="electric">⚡ Električni</option>
                    <option value="traditional">⛽ Tradicionalni (benzin/dizel)</option>
                    <option value="hybrid">🔋 Hibridni</option>
                  </>
                )}
                {vehicleInfo.vehicle_type === 'motorcycle' && (
                  <>
                    <option value="electric">⚡ Električni</option>
                    <option value="traditional">⛽ Tradicionalni</option>
                  </>
                )}
                {(vehicleInfo.vehicle_type === 'van' || vehicleInfo.vehicle_type === 'truck') && (
                  <>
                    <option value="diesel">⛽ Dizel</option>
                    <option value="electric">⚡ Električni</option>
                  </>
                )}
              </select>
            </div>
            
            <div className="form-group">
              <label>Registarska oznaka</label>
              <input
                name="vehicle_plate"
                value={vehicleInfo.vehicle_plate}
                onChange={handleVehicleChange}
                placeholder="npr. BG 123-AB"
              />
            </div>
            
            <div className="form-group">
              <label>Godina proizvodnje</label>
              <input
                type="number"
                name="vehicle_year"
                value={vehicleInfo.vehicle_year}
                onChange={handleVehicleChange}
              />
            </div>
          </div>
        )}
        
        <button type="submit" disabled={loading}>
          {loading ? 'Registracija...' : 'Registruj se'}
        </button>
      </form>
      <p>
        Već imate nalog? <Link to="/login">Prijavite se</Link>
      </p>
    </div>
  )
}

export default Register
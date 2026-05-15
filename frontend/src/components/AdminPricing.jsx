import { useState, useEffect } from 'react'
import api from '../services/api'

function AdminPricing() {
  const [pricingList, setPricingList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const fetchPricing = async () => {
    try {
      const res = await api.get('/admin/pricing/all')
      setPricingList(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPricing()
  }, [])

  const updatePricing = (id, field, value) => {
    setPricingList(prev => prev.map(p => 
      p.id === id ? { ...p, [field]: parseFloat(value) || 0 } : p
    ))
  }

  const handleSave = async (pricing) => {
    setSaving(true)
    setMessage('')
    try {
      await api.put(`/admin/pricing/${pricing.id}`, pricing)
      setMessage(`✅ Cenovnik za ${pricing.name} je ažuriran!`)
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setMessage('❌ Greška pri čuvanju')
    } finally {
      setSaving(false)
    }
  }

  const vehicleEmojis = {
    bike: '🚲',
    motorcycle: '🛵',
    car: '🚗',
    van: '🚐',
    truck: '🚛'
  }

  if (loading) return <div className="loading">Učitavanje cenovnika...</div>

  return (
    <div style={{ background: 'white', borderRadius: '20px', padding: '1.5rem' }}>
      <h2 style={{ marginBottom: '1rem', color: '#667eea' }}>💰 Cenovnik po klasama vozila</h2>
      
      {message && (
        <div style={{ 
          background: message.includes('✅') ? '#d4edda' : '#f8d7da',
          color: message.includes('✅') ? '#155724' : '#721c24',
          padding: '10px',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          {message}
        </div>
      )}
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {pricingList.map(pricing => (
          <div key={pricing.id} style={{ 
            border: '1px solid #ddd', 
            borderRadius: '16px', 
            padding: '1rem',
            background: '#fafbfc'
          }}>
            <h3 style={{ marginBottom: '1rem', color: '#667eea' }}>
              {vehicleEmojis[pricing.vehicle_class]} {pricing.name}
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label>Osnovna cena (RSD)</label>
                <input
                  type="number"
                  step="10"
                  value={pricing.base_price}
                  onChange={(e) => updatePricing(pricing.id, 'base_price', e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }}
                />
              </div>
              
              <div>
                <label>Cena po km (RSD/km)</label>
                <input
                  type="number"
                  step="1"
                  value={pricing.price_per_km}
                  onChange={(e) => updatePricing(pricing.id, 'price_per_km', e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }}
                />
              </div>
              
              <div>
                <label>Cena po kg (RSD/kg)</label>
                <input
                  type="number"
                  step="1"
                  value={pricing.price_per_kg}
                  onChange={(e) => updatePricing(pricing.id, 'price_per_kg', e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }}
                />
              </div>
              
              <div>
                <label>Max težina (kg)</label>
                <input
                  type="number"
                  step="10"
                  value={pricing.max_weight_kg}
                  onChange={(e) => updatePricing(pricing.id, 'max_weight_kg', e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }}
                />
              </div>
              
              <div>
                <label>Hitna dostava (x)</label>
                <input
                  type="number"
                  step="0.05"
                  value={pricing.urgent_multiplier}
                  onChange={(e) => updatePricing(pricing.id, 'urgent_multiplier', e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }}
                />
              </div>
              
              <div>
                <label>Volumetrijski delitelj</label>
                <input
                  type="number"
                  step="100"
                  value={pricing.volumetric_divisor}
                  onChange={(e) => updatePricing(pricing.id, 'volumetric_divisor', e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }}
                />
              </div>
            </div>
            
            <button 
              onClick={() => handleSave(pricing)} 
              disabled={saving}
              style={{
                background: '#28a745',
                color: 'white',
                padding: '8px 20px',
                border: 'none',
                borderRadius: '20px',
                cursor: 'pointer',
                marginTop: '1rem'
              }}
            >
              💾 Sačuvaj izmene za {pricing.name}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AdminPricing
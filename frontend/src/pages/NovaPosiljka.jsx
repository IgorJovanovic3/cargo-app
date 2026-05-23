import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import LocationPicker from '../components/LocationPicker'

function NovaPosiljka() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState('')
  const [priceBreakdown, setPriceBreakdown] = useState(null)
  const [isUrgent, setIsUrgent] = useState(false)
  const [vehicleClass, setVehicleClass] = useState('car')
  
  const [pickup, setPickup] = useState({ address: '', lat: 44.7866, lng: 20.4489 })
  const [delivery, setDelivery] = useState({ address: '', lat: 44.7875, lng: 20.4495 })
  const [cargoDescription, setCargoDescription] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [dimensions, setDimensions] = useState('')
  const [price, setPrice] = useState('')
  const [effectiveWeight, setEffectiveWeight] = useState(0)

  const parseDimensions = (dimStr) => {
    if (!dimStr) return { length: 0, width: 0, height: 0 }
    const parts = dimStr.toLowerCase().split('x')
    if (parts.length === 3) {
      return {
        length: parseFloat(parts[0]) || 0,
        width: parseFloat(parts[1]) || 0,
        height: parseFloat(parts[2]) || 0
      }
    }
    return { length: 0, width: 0, height: 0 }
  }

  const getSuggestedVehicleClass = (weight) => {
    if (weight <= 5) return 'bike'
    if (weight <= 20) return 'motorcycle'
    if (weight <= 100) return 'car'
    if (weight <= 500) return 'van'
    return 'truck'
  }

  useEffect(() => {
    const dims = parseDimensions(dimensions)
    const weight = parseFloat(weightKg) || 0
    const volumetricWeight = (dims.length * dims.width * dims.height) / 6000
    const effective = Math.max(weight, volumetricWeight)
    setEffectiveWeight(effective)
    
    if (effective > 0) {
      const suggested = getSuggestedVehicleClass(effective)
      if (suggested !== vehicleClass) {
        setVehicleClass(suggested)
      }
    }
  }, [weightKg, dimensions])

  useEffect(() => {
    const calculatePrice = async () => {
      if (!pickup.lat || !pickup.lng || !delivery.lat || !delivery.lng) return
      if (effectiveWeight === 0 && !weightKg) return
      
      setCalculating(true)
      setError('')
      try {
        const dims = parseDimensions(dimensions)
        
        const response = await api.post('/shipments/calculate-price', null, {
          params: {
            pickup_lat: pickup.lat,
            pickup_lng: pickup.lng,
            delivery_lat: delivery.lat,
            delivery_lng: delivery.lng,
            weight_kg: parseFloat(weightKg) || 0,
            length_cm: dims.length,
            width_cm: dims.width,
            height_cm: dims.height,
            is_urgent: isUrgent,
            vehicle_class: vehicleClass
          }
        })
        
        setPriceBreakdown(response.data)
        if (response.data.error) {
          setError(response.data.message)
          setPrice('')
        } else {
          setPrice(response.data.final_price)
        }
      } catch (err) {
        console.error('Greška pri izračunu cene:', err)
        setError(err.response?.data?.detail || 'Greška pri izračunu cene')
      } finally {
        setCalculating(false)
      }
    }
    
    const timeout = setTimeout(calculatePrice, 500)
    return () => clearTimeout(timeout)
  }, [pickup.lat, pickup.lng, delivery.lat, delivery.lng, effectiveWeight, isUrgent, vehicleClass, weightKg, dimensions])

  const handleVehicleClassChange = (e) => {
    setVehicleClass(e.target.value)
  }

  const handleSubmit = async (e) => {
  e.preventDefault()
  setError('')
  
  console.log('🚀 1. handleSubmit počeo')
  
  const token = localStorage.getItem('access_token')
  console.log('🔑 Token pre slanja:', token ? `${token.substring(0, 30)}...` : 'NEMA TOKENA')
  
  if (!token) {
    setError('Niste ulogovani. Molimo prijavite se ponovo.')
    return
  }
  
  // Validacija
  if (!pickup.address || pickup.lat === 0 || pickup.lng === 0) {
    setError('Morate odabrati adresu preuzimanja')
    return
  }
  if (!delivery.address || delivery.lat === 0 || delivery.lng === 0) {
    setError('Morate odabrati adresu dostave')
    return
  }
  if (!cargoDescription.trim()) {
    setError('Morate uneti opis robe')
    return
  }
  if (!weightKg || parseFloat(weightKg) <= 0) {
    setError('Morate uneti težinu paketa')
    return
  }
  if (!price || parseFloat(price) <= 0) {
    setError('Cena nije izračunata')
    return
  }
  
  console.log('✅ 2. Validacija prošla')
  setLoading(true)
  
  const payload = {
    pickup_address: pickup.address,
    pickup_lat: Number(pickup.lat),
    pickup_long: Number(pickup.lng),
    delivery_address: delivery.address,
    delivery_lat: Number(delivery.lat),
    delivery_long: Number(delivery.lng),
    cargo_description: cargoDescription,
    weight_kg: Number(weightKg),
    dimensions: dimensions || null,
    price: Number(price),
    is_urgent: isUrgent
  }
  
  console.log('📤 3. Slanje pošiljke:', payload)
  
  try {
    const response = await api.post('/shipments/create', payload)
    console.log('✅ 4. API odgovor:', response.data)
    console.log('✅ 5. Pošiljka kreirana, redirektujem...')
    
    // 🔥 NAVIGACIJA
    window.location.href = '/dashboard'
    console.log('✅ 6. window.location.href pozvan')
    
  } catch (err) {
    console.error('❌ Greška:', err)
    if (err.response) {
      console.error('Response data:', err.response.data)
      console.error('Response status:', err.response.status)
      
      if (err.response.status === 401) {
        setError('Niste autorizovani. Molimo prijavite se ponovo.')
        setTimeout(() => {
          window.location.href = '/login'
        }, 2000)
      } else if (err.response.status === 422) {
        setError('Greška pri validaciji podataka. Proverite sva polja.')
      } else {
        setError(err.response.data?.detail || `Greška ${err.response.status}`)
      }
    } else if (err.request) {
      setError('Nema odgovora od servera. Proverite mrežu.')
    } else {
      setError(err.message || 'Greška pri kreiranju pošiljke')
    }
  } finally {
    setLoading(false)
    console.log('🏁 7. Finally blok izvršen')
  }
}

  if (user?.user_type !== 'client') {
    return <p>Samo klijenti mogu kreirati pošiljke.</p>
  }

  const vehicleEmojis = {
    bike: '🚲',
    motorcycle: '🛵',
    car: '🚗',
    van: '🚐',
    truck: '🚛'
  }

  const suggestedClass = getSuggestedVehicleClass(effectiveWeight)

  return (
    <div className="nova-posiljka" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>Kreiraj novu pošiljku</h1>
      
      {error && (
        <div style={{ 
          color: 'red', 
          marginBottom: '1rem', 
          padding: '10px', 
          background: '#ffebee', 
          borderRadius: '8px',
          border: '1px solid #ffcdd2'
        }}>
          ❌ {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <LocationPicker
          label="📍 Adresa preuzimanja"
          value={pickup}
          onChange={setPickup}
          center={[44.7866, 20.4489]}
        />
        
        <LocationPicker
          label="🏁 Adresa dostave"
          value={delivery}
          onChange={setDelivery}
          center={[44.7875, 20.4495]}
        />
        
        <div className="form-group" style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Opis robe *</label>
          <textarea
            value={cargoDescription}
            onChange={(e) => setCargoDescription(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            rows="3"
          />
        </div>
        
        <div className="form-group" style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Težina (kg) *</label>
          <input
            type="number"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            step="0.1"
            placeholder="npr. 5.5"
            required
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
        </div>
        
        <div className="form-group" style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Dimenzije (Dužina x Širina x Visina u cm)</label>
          <input
            value={dimensions}
            onChange={(e) => setDimensions(e.target.value)}
            placeholder="npr. 50x40x30"
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
          <small style={{ color: '#666' }}>Za pakete preko 6000 cm³ računa se volumetrijska težina</small>
        </div>
        
        <div className="form-group" style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Tip vozila</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <select 
              value={vehicleClass} 
              onChange={handleVehicleClassChange}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}
            >
              <option value="bike">🚲 Bicikl (do 5kg)</option>
              <option value="motorcycle">🛵 Motocikl (do 20kg)</option>
              <option value="car">🚗 Automobil (do 100kg)</option>
              <option value="van">🚐 Kombi (do 500kg)</option>
              <option value="truck">🚛 Kamion (do 3000kg)</option>
            </select>
            {effectiveWeight > 0 && (
              <div style={{ fontSize: '0.85rem', background: '#e8f5e9', padding: '6px 12px', borderRadius: '20px' }}>
                {vehicleClass === suggestedClass ? (
                  <span style={{ color: '#2e7d32' }}>✅ Automatski odabrano za {effectiveWeight.toFixed(1)}kg</span>
                ) : (
                  <span style={{ color: '#ff9800' }}>💡 Predlažemo: {vehicleEmojis[suggestedClass]} za {effectiveWeight.toFixed(1)}kg</span>
                )}
              </div>
            )}
          </div>
          <small>Sistem automatski predlaže vozilo na osnovu težine</small>
        </div>
        
        <div className="form-group" style={{ marginBottom: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isUrgent}
              onChange={(e) => setIsUrgent(e.target.checked)}
            />
            🚀 Hitna dostava (+30%)
          </label>
        </div>
        
        {calculating && <p style={{ color: '#667eea' }}>🔄 Izračunavanje cene...</p>}
        
        {priceBreakdown && !calculating && !priceBreakdown.error && (
          <div style={{ 
            background: '#f0f4ff', 
            padding: '1rem', 
            borderRadius: '12px', 
            marginBottom: '1.5rem' 
          }}>
            <h3 style={{ marginBottom: '0.5rem', color: '#667eea' }}>
              {vehicleEmojis[priceBreakdown.vehicle_class]} Detalji cene ({priceBreakdown.vehicle_name}):
            </h3>
            <p>📏 Udaljenost: <strong>{priceBreakdown.distance_km} km</strong></p>
            <p>🚗 Cena po km: <strong>{priceBreakdown.distance_price} RSD</strong></p>
            <p>⚖️ Stvarna težina: <strong>{weightKg || 0} kg</strong></p>
            {priceBreakdown.volumetric_weight > 0 && (
              <p>📦 Volumetrijska težina: <strong>{priceBreakdown.volumetric_weight} kg</strong></p>
            )}
            <p>⚖️ Težina za naplatu: <strong>{priceBreakdown.effective_weight} kg</strong></p>
            <p>💰 Cena po težini: <strong>{priceBreakdown.weight_price} RSD</strong></p>
            <p>🏁 Osnovna cena: <strong>{priceBreakdown.base_price} RSD</strong></p>
            {priceBreakdown.is_urgent && (
              <p>🚀 Hitna dostava: <strong>{priceBreakdown.urgent_multiplier}x</strong></p>
            )}
            <p>📦 Maksimalna težina za ovu klasu: <strong>{priceBreakdown.max_weight_kg} kg</strong></p>
            <hr style={{ margin: '0.5rem 0' }} />
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
              UKUPNO: <span style={{ color: '#667eea' }}>{priceBreakdown.final_price} RSD</span>
            </p>
          </div>
        )}
        
        {priceBreakdown?.error && (
          <div style={{ background: '#f8d7da', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', color: '#721c24' }}>
            <p><strong>⚠️ Problem sa težinom</strong></p>
            <p>{priceBreakdown.message}</p>
            {priceBreakdown.suggested_class && (
              <p>Predlažemo: <strong>{priceBreakdown.suggested_class}</strong></p>
            )}
          </div>
        )}
        
        <div className="form-group" style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Cena (RSD) *</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            disabled
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', background: '#f5f5f5' }}
          />
          <small style={{ color: '#666' }}>Cena se automatski izračunava</small>
        </div>
        
        <button 
          type="submit" 
          disabled={loading || calculating}
          style={{
            width: '100%',
            padding: '12px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: loading || calculating ? 'not-allowed' : 'pointer',
            opacity: loading || calculating ? 0.7 : 1
          }}
        >
          {loading ? 'Kreiranje...' : 'Kreiraj pošiljku'}
        </button>
      </form>
    </div>
  )
}

export default NovaPosiljka
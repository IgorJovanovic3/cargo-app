import { useState, useEffect } from 'react'
import api from '../services/api'
import LocationPicker from './LocationPicker'

function EditShipmentModal({ shipment, onClose, onSuccess }) {
  const [pickup, setPickup] = useState({
    address: shipment.pickup_address,
    lat: shipment.pickup_lat,
    lng: shipment.pickup_lng
  })
  const [delivery, setDelivery] = useState({
    address: shipment.delivery_address,
    lat: shipment.delivery_lat,
    lng: shipment.delivery_lng
  })
  const [cargoDescription, setCargoDescription] = useState(shipment.cargo_description)
  const [weightKg, setWeightKg] = useState(shipment.weight_kg || '')
  const [dimensions, setDimensions] = useState(shipment.dimensions || '')
  const [priceBreakdown, setPriceBreakdown] = useState(null)
  const [calculating, setCalculating] = useState(false)
  const [loading, setLoading] = useState(false)

  // Funkcija za parsiranje dimenzija
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

  useEffect(() => {
    const calculatePrice = async () => {
      if (!pickup.lat || !pickup.lng || !delivery.lat || !delivery.lng) return
      
      setCalculating(true)
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
            is_urgent: shipment.is_urgent === 1
          }
        })
        
        setPriceBreakdown(response.data)
      } catch (err) {
        console.error('Greška pri izračunu cene:', err)
      } finally {
        setCalculating(false)
      }
    }
    
    const timeout = setTimeout(calculatePrice, 500)
    return () => clearTimeout(timeout)
  }, [pickup.lat, pickup.lng, delivery.lat, delivery.lng, weightKg, dimensions, shipment.is_urgent])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      await api.put(`/shipments/${shipment.id}`, {
        pickup_address: pickup.address,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        delivery_address: delivery.address,
        delivery_lat: delivery.lat,
        delivery_lng: delivery.lng,
        cargo_description: cargoDescription,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        dimensions: dimensions || null
      })
      
      alert('✅ Pošiljka je uspešno izmenjena!')
      onSuccess()
    } catch (err) {
      console.error(err)
      alert('Greška pri izmeni pošiljke')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '1.5rem',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <h3 style={{ marginBottom: '1rem', color: '#667eea' }}>
          ✏️ Izmena pošiljke #{shipment.id}
        </h3>
        
        <form onSubmit={handleSubmit}>
          <LocationPicker
            label="📍 Adresa preuzimanja"
            value={pickup}
            onChange={setPickup}
            center={[pickup.lat, pickup.lng]}
          />
          
          <LocationPicker
            label="🏁 Adresa dostave"
            value={delivery}
            onChange={setDelivery}
            center={[delivery.lat, delivery.lng]}
          />
          
          <div className="form-group">
            <label>Opis robe *</label>
            <textarea
              value={cargoDescription}
              onChange={(e) => setCargoDescription(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                resize: 'vertical'
              }}
            />
          </div>
          
          <div className="form-group">
            <label>Težina (kg)</label>
            <input
              type="number"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '8px'
              }}
            />
          </div>
          
          <div className="form-group">
            <label>Dimenzije (Dužina x Širina x Visina u cm)</label>
            <input
              type="text"
              value={dimensions}
              onChange={(e) => setDimensions(e.target.value)}
              placeholder="npr. 50x40x30"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '8px'
              }}
            />
            <small style={{ color: '#666' }}>Za pakete preko 6000 cm³ računa se volumetrijska težina</small>
          </div>
          
          {calculating && <p style={{ color: '#666' }}>🔄 Izračunavanje cene...</p>}
          
          {priceBreakdown && !calculating && (
            <div style={{ 
              background: '#f0f4ff', 
              padding: '1rem', 
              borderRadius: '12px', 
              marginBottom: '1rem',
              fontSize: '0.85rem'
            }}>
              <h4 style={{ marginBottom: '0.5rem', color: '#667eea' }}>💰 Detalji cene:</h4>
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
              <hr style={{ margin: '0.5rem 0' }} />
              <p style={{ fontSize: '1rem', fontWeight: 'bold' }}>
                UKUPNO: <span style={{ color: '#667eea' }}>{priceBreakdown.final_price} RSD</span>
              </p>
            </div>
          )}
          
          <div className="form-group">
            <label>Cena (RSD)</label>
            <input
              type="number"
              value={priceBreakdown?.final_price || shipment.price}
              disabled
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                background: '#f5f5f5'
              }}
            />
            <small style={{ color: '#666' }}>Cena se automatski ažurira prema izmenama</small>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button 
              type="button" 
              onClick={onClose} 
              style={{ 
                background: '#dc3545', 
                flex: 1,
                padding: '12px'
              }}
            >
              Otkaži
            </button>
            <button 
              type="submit" 
              disabled={loading || calculating} 
              style={{ 
                flex: 1,
                padding: '12px'
              }}
            >
              {loading ? 'Čuvanje...' : '💾 Sačuvaj izmene'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditShipmentModal
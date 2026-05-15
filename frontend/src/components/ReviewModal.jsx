import { useState } from 'react'
import api from '../services/api'
import RatingStars from './RatingStars'

function ReviewModal({ shipment, isOpen, onClose, onSuccess }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // ISPRAVNA RUTA: /reviews/driver/{shipment_id} za ocenu vozača
      await api.post(`/reviews/driver/${shipment.id}`, {
        rating: rating,
        comment: comment
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Greška pri slanju ocene')
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
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }} onClick={onClose}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        width: '400px',
        maxWidth: '90%'
      }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: '16px' }}>⭐ Ocenite vozača</h2>
        <p style={{ marginBottom: '16px', color: '#666' }}>
          Pošiljka #{shipment.id} - {shipment.delivery_address}
        </p>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Vaša ocena:
            </label>
            <RatingStars rating={rating} onRatingChange={setRating} size={32} />
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Komentar (opciono):
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                resize: 'vertical'
              }}
              placeholder="Podelite vaše iskustvo sa vozačem..."
            />
          </div>
          
          {error && <div style={{ color: 'red', marginBottom: '16px' }}>{error}</div>}
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{
              background: '#f0f0f0',
              color: '#333'
            }}>
              Otkaži
            </button>
            <button type="submit" disabled={loading}>
              {loading ? 'Slanje...' : 'Pošalji ocenu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ReviewModal
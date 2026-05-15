import { useRef, useState } from 'react'

function SignaturePad({ onSave, onClose }) {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [signature, setSignature] = useState(null)

  const startDrawing = (e) => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX || e.touches[0].clientX) - rect.left
    const y = (e.clientY || e.touches[0].clientY) - rect.top
    
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e) => {
    if (!isDrawing) return
    e.preventDefault()
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX || e.touches[0].clientX) - rect.left
    const y = (e.clientY || e.touches[0].clientY) - rect.top
    
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.beginPath()
    setSignature(null)
  }

  const saveSignature = () => {
    const canvas = canvasRef.current
    const signatureData = canvas.toDataURL('image/png')
    setSignature(signatureData)
    onSave(signatureData)
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
        maxWidth: '450px'
      }}>
        <h3 style={{ textAlign: 'center', marginBottom: '1rem' }}>✍️ Potpis primaoca</h3>
        
        <div style={{
          border: '2px solid #ddd',
          borderRadius: '12px',
          overflow: 'hidden',
          marginBottom: '1rem'
        }}>
          <canvas
            ref={canvasRef}
            width={400}
            height={200}
            style={{
              width: '100%',
              height: '200px',
              touchAction: 'none',
              background: 'white'
            }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
        
        <p style={{ fontSize: '0.8rem', color: '#666', textAlign: 'center', marginBottom: '1rem' }}>
          Potpišite na ekranu
        </p>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            type="button"
            onClick={clearCanvas}
            style={{ background: '#ffc107', color: '#333', width: 'auto', flex: 1 }}
          >
            🧽 Obriši
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ background: '#dc3545', width: 'auto', flex: 1 }}
          >
            Otkaži
          </button>
          <button
            type="button"
            onClick={saveSignature}
            style={{ background: '#28a745', width: 'auto', flex: 1 }}
          >
            💾 Sačuvaj potpis
          </button>
        </div>
      </div>
    </div>
  )
}

export default SignaturePad
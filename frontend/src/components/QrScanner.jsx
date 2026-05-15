import { useEffect, useRef, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'

function QrScanner({ onScan, onClose }) {
  const [error, setError] = useState('')
  const scannerRef = useRef(null)

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        showTorchButtonIfSupported: true
      },
      false
    )

    scanner.render(
      (decodedText) => {
        if (decodedText && decodedText.startsWith('CARGO:')) {
          const shipmentId = decodedText.replace('CARGO:', '')
          scanner.clear()
          onScan(shipmentId)
        } else if (decodedText) {
          setError('Nevažeći QR kod')
        }
      },
      (errorMessage) => {
        console.error(errorMessage)
      }
    )

    scannerRef.current = scanner

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear()
      }
    }
  }, [onScan])

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.9)',
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '1rem',
        width: '90%',
        maxWidth: '450px'
      }}>
        <h3 style={{ textAlign: 'center', marginBottom: '1rem' }}>📷 Skeniraj QR kod</h3>
        
        <div id="qr-reader" style={{ width: '100%' }}></div>
        
        {error && <p style={{ color: 'red', textAlign: 'center', marginTop: '1rem' }}>{error}</p>}
        
        <button 
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: '1rem',
            background: '#dc3545'
          }}
        >
          Zatvori
        </button>
      </div>
    </div>
  )
}

export default QrScanner
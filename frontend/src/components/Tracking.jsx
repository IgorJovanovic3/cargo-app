import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import api from '../services/api'

// Fix za default ikonu
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

function Tracking({ shipmentId }) {
  const [location, setLocation] = useState(null)

  useEffect(() => {
    const fetchLocation = () => {
      api.get(`/shipments/${shipmentId}/location`)
        .then(res => {
          if (res.data.lat) {
            setLocation(res.data)
          }
        })
        .catch(err => console.error(err))
    }

    fetchLocation()
    const interval = setInterval(fetchLocation, 10000) // Osvežavaj svakih 10 sekundi

    return () => clearInterval(interval)
  }, [shipmentId])

  if (!location) {
    return <p className="no-location">📍 Lokacija vozača nije dostupna</p>
  }

  return (
    <div className="tracking">
      <h4>📍 Lokacija vozača</h4>
      <MapContainer 
        center={[location.lat, location.lng]} 
        zoom={13}
        style={{ height: '250px', width: '100%' }}
      >
        <TileLayer 
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Marker position={[location.lat, location.lng]}>
          <Popup>Vozač je ovde</Popup>
        </Marker>
      </MapContainer>
      <small>Poslednje ažuriranje: {new Date(location.last_update).toLocaleString('sr-RS')}</small>
    </div>
  )
}

export default Tracking
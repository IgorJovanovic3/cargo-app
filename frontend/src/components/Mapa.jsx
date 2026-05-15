import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'
import 'leaflet-defaulticon-compatibility'

function Map({ pickup, delivery, driverLocation }) {
  const position = driverLocation || pickup || { lat: 44.7866, lng: 20.4489 }
  
  return (
    <MapContainer
      center={[position.lat, position.lng]}
      zoom={13}
      style={{ height: '400px', width: '100%', borderRadius: '16px' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
      />
      
      {pickup && (
        <Marker position={[pickup.lat, pickup.lng]}>
          <Popup>📍 Preuzimanje</Popup>
        </Marker>
      )}
      
      {delivery && (
        <Marker position={[delivery.lat, delivery.lng]}>
          <Popup>🏁 Dostava</Popup>
        </Marker>
      )}
      
      {driverLocation && (
        <Marker position={[driverLocation.lat, driverLocation.lng]}>
          <Popup>🚚 Vozač je ovde</Popup>
        </Marker>
      )}
      
      {pickup && delivery && (
        <Polyline
          positions={[[pickup.lat, pickup.lng], [delivery.lat, delivery.lng]]}
          color="#667eea"
          weight={3}
        />
      )}
    </MapContainer>
  )
}

export default Map
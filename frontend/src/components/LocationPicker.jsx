import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import AddressAutocomplete from './AddressAutocomplete'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

function LocationPicker({ label, value, onChange, center = [44.7866, 20.4489] }) {
  const [position, setPosition] = useState(
    value?.lat && value?.lng ? [value.lat, value.lng] : center
  )
  const [address, setAddress] = useState(value?.address || '')

  function LocationMarker() {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng
        setPosition([lat, lng])
        onChange({ lat, lng, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` })
        
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
          .then(res => res.json())
          .then(data => {
            if (data.display_name) {
              setAddress(data.display_name)
              onChange({ lat, lng, address: data.display_name })
            }
          })
          .catch(err => console.error(err))
      }
    })
    return position ? <Marker position={position} /> : null
  }

  const handleAddressSelect = (selectedAddress) => {
    setPosition([selectedAddress.lat, selectedAddress.lng])
    setAddress(selectedAddress.address)
    onChange(selectedAddress)
  }

  return (
    <div className="location-picker" style={{ marginBottom: '1.5rem' }}>
      <AddressAutocomplete
        value={address}
        onChange={handleAddressSelect}
        placeholder="Unesite adresu (ulica i broj)..."
        label={label}
      />
      
      <MapContainer
        center={position}
        zoom={14}
        style={{ height: '250px', width: '100%', borderRadius: '16px', marginTop: '8px' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />
        <LocationMarker />
      </MapContainer>
      
      {position && (
        <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
          📍 Koordinate: {position[0].toFixed(5)}, {position[1].toFixed(5)}
        </small>
      )}
    </div>
  )
}

export default LocationPicker
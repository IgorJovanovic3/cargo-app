import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

function AddressAutocomplete({ value, onChange, placeholder, label }) {
  const [query, setQuery] = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceTimer = useRef(null)

  useEffect(() => {
    if (value) setQuery(value)
  }, [value])

  const searchAddress = async (searchText) => {
    if (!searchText || searchText.length < 3) {
      setSuggestions([])
      return
    }

    setLoading(true)
    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: searchText,
          format: 'json',
          addressdetails: 1,
          limit: 8,
          'accept-language': 'sr',
          countrycodes: 'rs',
          namedetails: 1,
          extratags: 1,
          featuretype: 'street',
          zoom: 18,
          detailed: 1
        },
        headers: { 'User-Agent': 'CargoApp/1.0' }
      })

      const results = response.data.map(item => {
        let street = item.address?.road || item.address?.pedestrian || ''
        let houseNumber = item.address?.house_number || ''
        let city = item.address?.city || item.address?.town || item.address?.village || ''

        let displayName = ''
        if (street) {
          displayName = street
          if (houseNumber) displayName += ` ${houseNumber}`
          if (city) displayName += `, ${city}`
        } else if (city) {
          displayName = city
        } else {
          displayName = item.display_name.split(',')[0]
        }

        return {
          display_name: displayName,
          full_address: item.display_name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          street: street,
          house_number: houseNumber,
          city: city,
          type: item.type
        }
      })

      const filteredResults = results.filter(r => r.type === 'street' || r.type === 'house' || r.house_number)
      const sortedResults = [...filteredResults].sort((a, b) => {
        if (a.house_number && !b.house_number) return -1
        if (!a.house_number && b.house_number) return 1
        return 0
      })

      setSuggestions(sortedResults.length > 0 ? sortedResults : results)
    } catch (error) {
      console.error('Greška:', error)
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const newValue = e.target.value
    setQuery(newValue)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => searchAddress(newValue), 500)
  }

  const handleSelectSuggestion = (suggestion) => {
    setQuery(suggestion.display_name)
    setShowSuggestions(false)
    onChange({
      address: suggestion.full_address || suggestion.display_name,
      lat: suggestion.lat,
      lng: suggestion.lon,
      street: suggestion.street,
      house_number: suggestion.house_number,
      city: suggestion.city
    })
  }

  return (
    <div style={{ position: 'relative', marginBottom: '1rem' }}>
      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>{label}</label>
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '12px 16px',
          border: '2px solid #eef2f6',
          borderRadius: '16px',
          fontSize: '1rem'
        }}
      />
      
      {loading && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'white',
          border: '1px solid #eef2f6',
          borderRadius: '12px',
          padding: '8px',
          marginTop: '4px',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <div style={{ padding: '8px', color: '#999' }}>🔍 Pretražujem...</div>
        </div>
      )}
      
      {showSuggestions && suggestions.length > 0 && !loading && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'white',
          border: '1px solid #eef2f6',
          borderRadius: '12px',
          marginTop: '4px',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          {suggestions.map((suggestion, idx) => (
            <div
              key={idx}
              onClick={() => handleSelectSuggestion(suggestion)}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                borderBottom: idx < suggestions.length - 1 ? '1px solid #f0f0f0' : 'none'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
            >
              <div style={{ fontSize: '0.85rem', color: '#333' }}>
                📍 {suggestion.display_name}
              </div>
              {suggestion.house_number && (
                <div style={{ fontSize: '0.7rem', color: '#999', marginTop: '2px' }}>
                  Broj: {suggestion.house_number}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AddressAutocomplete
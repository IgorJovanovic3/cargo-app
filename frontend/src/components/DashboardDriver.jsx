import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import Chat from '../components/Chat'
import QrScanner from '../components/QrScanner'
import EditShipmentModal from './EditShipmentModal'
import SignaturePad from '../components/SignaturePad'
import RatingStars from './RatingStars'
import RatingHistogram from './RatingHistogram'
import { useTranslation } from 'react-i18next'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Title } from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Title)

const WS_URL = window.location.protocol === 'https:' 
  ? 'wss://cargo-backend-mqx7.onrender.com' 
  : 'ws://localhost:8000'

// Fix za marker ikone
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

function DashboardDriver() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [availableShipments, setAvailableShipments] = useState([])
  const [myShipments, setMyShipments] = useState([])
  const [activeShipment, setActiveShipment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [availablePage, setAvailablePage] = useState(1)
  const [availableTotalPages, setAvailableTotalPages] = useState(1)
  const [activeTab, setActiveTab] = useState('available')
  const [showScanner, setShowScanner] = useState(false)
  const [editingShipment, setEditingShipment] = useState(null)
  const [showSignaturePad, setShowSignaturePad] = useState(false)
  const [tabKey, setTabKey] = useState(0)
  const [driverShipmentsByMonth, setDriverShipmentsByMonth] = useState(null)
  const [driverEarningsByMonth, setDriverEarningsByMonth] = useState(null)
  const [showShipmentsMap, setShowShipmentsMap] = useState(false)
  
  const [showClientReviewModal, setShowClientReviewModal] = useState(false)
  const [selectedShipmentForClientReview, setSelectedShipmentForClientReview] = useState(null)
  const [clientRating, setClientRating] = useState(5)
  const [clientComment, setClientComment] = useState('')
  const [driverRatingData, setDriverRatingData] = useState(null)
  const [reviewedClientShipments, setReviewedClientShipments] = useState(new Set())
  
  const wsRef = useRef(null)
  const locationIntervalRef = useRef(null)

  const fetchData = async () => {
    try {
      const [availableRes, myRes] = await Promise.all([
        api.get('/shipments/available/', {
          params: { page: availablePage, limit: 10 }
        }),
        api.get('/shipments/driver/')
      ])
      setAvailableShipments(availableRes.data.shipments)
      setAvailableTotalPages(availableRes.data.total_pages)
      setMyShipments(myRes.data.shipments)
      
      const active = myRes.data.shipments.find(s => s.status !== 'delivered' && s.status !== 'cancelled')
      setActiveShipment(active)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchDriverChartData = async () => {
    try {
      const [shipmentsRes, earningsRes] = await Promise.all([
        api.get('/shipments/driver/stats/shipments-by-month'),
        api.get('/shipments/driver/stats/earnings-by-month')
      ])
      setDriverShipmentsByMonth(shipmentsRes.data)
      setDriverEarningsByMonth(earningsRes.data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchData()
    fetchDriverChartData()
  }, [availablePage])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [activeTab, tabKey])

  useEffect(() => {
    if (!user || user.user_type !== 'driver') return
    
    const fetchDriverRating = async () => {
      try {
        const res = await api.get(`/reviews/driver/${user.id}`)
        setDriverRatingData(res.data)
      } catch (err) {
        console.error(err)
      }
    }
    
    fetchDriverRating()
  }, [user, myShipments])

  useEffect(() => {
    const fetchReviewedStatus = async () => {
      const reviewedSet = new Set()
      for (const shipment of myShipments) {
        if (shipment.status === 'delivered') {
          try {
            const res = await api.get(`/reviews/can-review/${shipment.id}`)
            if (!res.data.can_review) {
              reviewedSet.add(shipment.id)
            }
          } catch (err) {
            console.error(err)
          }
        }
      }
      setReviewedClientShipments(reviewedSet)
    }
    
    if (myShipments.length > 0) {
      fetchReviewedStatus()
    }
  }, [myShipments])

  // WebSocket za slanje lokacije
  useEffect(() => {
    if (!activeShipment || !user) return

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close()
    }
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current)
    }

    const ws = new WebSocket(`${WS_URL}/ws/driver/${user.id}`)
    wsRef.current = ws
    
    ws.onopen = () => {
      console.log('✅ Driver WebSocket connected')
      
      locationIntervalRef.current = setInterval(() => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const locationData = {
                type: 'location_update',
                shipment_id: activeShipment.id,
                lat: position.coords.latitude,
                lng: position.coords.longitude
              }
              
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify(locationData))
              }
            },
            (error) => console.error('Geolocation error:', error),
            { enableHighAccuracy: true, maximumAge: 3000, timeout: 5000 }
          )
        }
      }, 5000)
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    ws.onclose = () => {
      console.log('Driver WebSocket closed')
    }
    
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close()
      }
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current)
      }
    }
  }, [activeShipment, user])

  const handleAccept = async (shipmentId) => {
    try {
      await api.post(`/shipments/${shipmentId}/accept`)
      fetchData()
    } catch (err) {
      alert(err.response?.data?.detail || t('accept_error'))
    }
  }

  const handleUpdateStatus = async (status) => {
    if (!activeShipment) return
    
    try {
      await api.put(`/shipments/${activeShipment.id}/status`, { status })
      fetchData()
    } catch (err) {
      alert(err.response?.data?.detail || t('status_error'))
    }
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setTabKey(prev => prev + 1)
  }

  const handleQrScan = (shipmentId) => {
    setShowScanner(false)
    const shipment = [...myShipments, ...availableShipments].find(s => s.id == shipmentId)
    if (shipment) {
      setEditingShipment(shipment)
    } else {
      alert(t('shipment_not_found'))
    }
  }

  const handleCompleteDelivery = async (signatureData) => {
    try {
      await api.put(`/shipments/${activeShipment.id}/complete`, {
        signature: signatureData
      })
      alert(t('delivery_completed'))
      setShowSignaturePad(false)
      fetchData()
    } catch (err) {
      alert(t('signature_error'))
    }
  }

  const handleRateClient = async (shipment) => {
    try {
      await api.post(`/reviews/client/${shipment.id}`, {
        rating: clientRating,
        comment: clientComment
      })
      alert(t('client_rated'))
      setShowClientReviewModal(false)
      setSelectedShipmentForClientReview(null)
      setClientRating(5)
      setClientComment('')
      fetchData()
      setReviewedClientShipments(prev => new Set([...prev, shipment.id]))
    } catch (err) {
      alert(err.response?.data?.detail || t('rating_error'))
    }
  }

  const showEarningsStats = async () => {
    try {
      const res = await api.get('/shipments/driver/earnings')
      let message = `${t('earnings_stats')}:\n`
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
      message += `${t('total_shipments_stats')}: ${res.data.total_shipments}\n`
      message += `${t('total_earnings_stats')}: ${res.data.total_earnings} ${t('rsd')}\n`
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
      message += `${t('by_month')}:\n`
      
      const months = Object.keys(res.data.earnings_by_month).sort().reverse()
      for (const month of months) {
        const data = res.data.earnings_by_month[month]
        message += `   ${month}: ${data.count} ${t('shipments_count')} / ${data.total} ${t('rsd')}\n`
      }
      
      alert(message)
    } catch (err) {
      alert(t('error_stats'))
    }
  }

  if (loading) return <div className="loading">{t('loading')}</div>

  const statusButtons = {
    accepted: { next: 'picked_up', label: '📦 ' + t('picked_up_btn'), color: '#4caf50' },
    picked_up: { next: 'in_transit', label: '🚚 ' + t('in_transit_btn'), color: '#2196f3' },
    in_transit: { next: 'delivered', label: '🏁 ' + t('delivered_btn'), color: '#9c27b0' }
  }

  const StatusBadge = ({ status }) => {
    const config = {
      pending: { bg: '#fff3e0', color: '#ff9800', text: t('pending') },
      accepted: { bg: '#e3f2fd', color: '#2196f3', text: t('accepted') },
      picked_up: { bg: '#e8f5e9', color: '#4caf50', text: t('picked_up') },
      in_transit: { bg: '#f3e5f5', color: '#9c27b0', text: t('in_transit') },
      delivered: { bg: '#e8f5e9', color: '#2e7d32', text: t('delivered') },
      cancelled: { bg: '#ffebee', color: '#f44336', text: t('cancelled') }
    }
    const c = config[status] || config.pending
    return (
      <span style={{
        background: c.bg,
        color: c.color,
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '0.7rem',
        fontWeight: '600'
      }}>
        {c.text}
      </span>
    )
  }

  return (
    <div key={tabKey} style={{ padding: '0 0 1rem 0' }} onClick={(e) => e.stopPropagation()}>
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '20px',
        padding: '1rem 1.5rem',
        marginBottom: '1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h1 style={{ color: 'white', margin: 0, fontSize: '1.5rem' }}>{t('driver_dashboard')}</h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', margin: '4px 0 0 0' }}>
            {t('welcome')} {user?.full_name}!
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => window.location.href = '/shipments/driver/export/excel'}
            style={{
              width: 'auto',
              background: '#28a745',
              padding: '10px 20px',
              borderRadius: '40px'
            }}
          >
            📊 {t('export_excel')}
          </button>
          <button
            onClick={showEarningsStats}
            style={{
              width: 'auto',
              background: '#17a2b8',
              padding: '10px 20px',
              borderRadius: '40px'
            }}
          >
            📈 {t('earnings_stats')}
          </button>
          <button
            onClick={() => setShowScanner(true)}
            style={{
              width: 'auto',
              background: '#28a745',
              padding: '10px 20px',
              borderRadius: '40px'
            }}
          >
            📷 {t('scan_qr')}
          </button>
          {driverRatingData && driverRatingData.total_reviews > 0 && (
            <div style={{
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '40px',
              padding: '8px 20px',
              textAlign: 'center'
            }}>
              <div style={{ color: 'white', fontWeight: 'bold' }}>
                ⭐ {driverRatingData.average_rating} / 5
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem' }}>
                {driverRatingData.total_reviews} {t('ratings')}
              </div>
            </div>
          )}
        </div>
      </div>

      {driverRatingData && driverRatingData.total_reviews > 0 && (
        <div style={{ 
          background: 'white', 
          borderRadius: '16px', 
          padding: '1rem', 
          marginBottom: '1rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0 }}>⭐ {t('my_rating_driver')}: {driverRatingData.average_rating}/5</h3>
              <p style={{ margin: '4px 0 0', color: '#666', fontSize: '0.8rem' }}>
                {t('based_on')} {driverRatingData.total_reviews} {t('client_ratings')}
              </p>
            </div>
            <div style={{ fontSize: '1.5rem' }}>
              {'★'.repeat(Math.round(driverRatingData.average_rating))}
              {'☆'.repeat(5 - Math.round(driverRatingData.average_rating))}
            </div>
          </div>
          <RatingHistogram histogram={driverRatingData.histogram} totalReviews={driverRatingData.total_reviews} />
        </div>
      )}

      {(driverShipmentsByMonth && driverShipmentsByMonth.labels && driverShipmentsByMonth.labels.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1rem' }}>
            <h3>📦 Moje pošiljke po mesecima</h3>
            <Line
              data={{
                labels: driverShipmentsByMonth.labels,
                datasets: [{
                  label: 'Broj pošiljki',
                  data: driverShipmentsByMonth.data,
                  borderColor: '#667eea',
                  backgroundColor: 'rgba(102, 126, 234, 0.1)',
                  tension: 0.4,
                  fill: true
                }]
              }}
              options={{ responsive: true, maintainAspectRatio: true }}
            />
          </div>
          {driverEarningsByMonth && driverEarningsByMonth.labels && driverEarningsByMonth.labels.length > 0 && (
            <div style={{ background: 'white', borderRadius: '16px', padding: '1rem' }}>
              <h3>💰 Moja zarada po mesecima (RSD)</h3>
              <Bar
                data={{
                  labels: driverEarningsByMonth.labels,
                  datasets: [{
                    label: t('earnings_chart_label'),
                    data: driverEarningsByMonth.data,
                    backgroundColor: '#28a745',
                    borderRadius: 8
                  }]
                }}
                options={{ responsive: true, maintainAspectRatio: true }}
              />
            </div>
          )}
        </div>
      )}

      {activeShipment && (
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '1rem 1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          border: '2px solid #667eea'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, color: '#667eea' }}>🎯 {t('active_shipment')} #{activeShipment.id}</h3>
                {activeShipment.is_urgent === 1 && (
                  <span style={{ background: '#ff9800', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.7rem' }}>
                    🚀 {t('urgent')}
                  </span>
                )}
                <StatusBadge status={activeShipment.status} />
              </div>
              <p style={{ margin: '8px 0 4px', color: '#555' }}>
                📍 {activeShipment.pickup_address.split(',')[0]} → {activeShipment.delivery_address.split(',')[0]}
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#999' }}>
                💰 {activeShipment.price} RSD {activeShipment.weight_kg && `• ⚖️ ${activeShipment.weight_kg} kg`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {activeShipment.status === 'in_transit' && (
                <button
                  onClick={() => setShowSignaturePad(true)}
                  style={{
                    width: 'auto',
                    background: '#17a2b8',
                    padding: '10px 20px',
                    borderRadius: '40px'
                  }}
                >
                  ✍️ {t('complete_delivery')}
                </button>
              )}
              {statusButtons[activeShipment.status] && (
                <button
                  onClick={() => handleUpdateStatus(statusButtons[activeShipment.status].next)}
                  style={{
                    background: statusButtons[activeShipment.status].color,
                    width: 'auto',
                    padding: '10px 24px',
                    borderRadius: '40px',
                    fontWeight: 'bold'
                  }}
                >
                  {statusButtons[activeShipment.status].label}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        borderBottom: '2px solid #eef2f6',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => handleTabChange('available')}
          style={{
            width: 'auto',
            background: activeTab === 'available' ? '#667eea' : 'transparent',
            color: activeTab === 'available' ? 'white' : '#666',
            borderRadius: '40px 40px 0 0',
            padding: '10px 24px'
          }}
        >
          📋 {t('available_shipments')} ({availableShipments.length})
        </button>
        <button
          onClick={() => handleTabChange('my')}
          style={{
            width: 'auto',
            background: activeTab === 'my' ? '#667eea' : 'transparent',
            color: activeTab === 'my' ? 'white' : '#666',
            borderRadius: '40px 40px 0 0',
            padding: '10px 24px'
          }}
        >
          🚚 {t('my_shipments_driver')} ({myShipments.length})
        </button>
      </div>

      {activeTab === 'available' && (
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '1.25rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
        }}>
          {/* Dugme za prikaz mape */}
          <button
            onClick={() => setShowShipmentsMap(!showShipmentsMap)}
            style={{
              width: 'auto',
              marginBottom: '1rem',
              background: showShipmentsMap ? '#dc3545' : '#28a745'
            }}
          >
            {showShipmentsMap ? '📋 Prikaži listu' : '🗺️ Prikaži na mapi'}
          </button>

          {/* Mapa dostupnih vožnji */}
          {showShipmentsMap && (
            <div style={{ marginBottom: '1rem', height: '400px', borderRadius: '12px', overflow: 'hidden' }}>
              <MapContainer
                center={[44.7866, 20.4489]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                />
                {availableShipments.map(shipment => (
                  <Marker
                    key={shipment.id}
                    position={[shipment.pickup_lat, shipment.pickup_lng]}
                  >
                    <Popup>
                      <strong>#{shipment.id}</strong><br />
                      📍 {shipment.pickup_address.substring(0, 40)}<br />
                      🏁 {shipment.delivery_address.substring(0, 40)}<br />
                      💰 {shipment.price} RSD<br />
                      {shipment.is_urgent === 1 && <span>🚀 Hitno<br /></span>}
                      <button
                        onClick={() => handleAccept(shipment.id)}
                        style={{
                          marginTop: '8px',
                          padding: '4px 12px',
                          background: '#4caf50',
                          borderRadius: '20px',
                          fontSize: '0.7rem'
                        }}
                      >
                        ✅ Prihvati
                      </button>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}

          {/* Lista dostupnih vožnji */}
          {!showShipmentsMap && (
            <>
              {availableShipments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                  📭 {t('no_available_shipments')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {availableShipments.map(shipment => (
                    <div key={shipment.id} style={{
                      background: '#fafbfc',
                      borderRadius: '16px',
                      padding: '1rem',
                      border: '1px solid #eef2f6',
                      transition: 'all 0.3s',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#667eea'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = '#eef2f6'}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                            <strong style={{ fontSize: '1rem', color: '#333' }}>#{shipment.id}</strong>
                            {shipment.is_urgent === 1 && (
                              <span style={{ background: '#ff9800', color: 'white', padding: '2px 8px', borderRadius: '20px', fontSize: '0.6rem' }}>🚀</span>
                            )}
                          </div>
                          <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#555' }}>
                            📍 {shipment.pickup_address.split(',')[0]} → {shipment.delivery_address.split(',')[0]}
                          </p>
                          <p style={{ margin: 0, fontSize: '0.7rem', color: '#999' }}>
                            {shipment.cargo_description.substring(0, 50)} • 💰 {shipment.price} RSD
                            {shipment.weight_kg && ` • ⚖️ ${shipment.weight_kg} kg`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleAccept(shipment.id)}
                          style={{
                            width: 'auto',
                            padding: '8px 20px',
                            borderRadius: '40px',
                            fontSize: '0.8rem',
                            background: '#4caf50'
                          }}
                        >
                          ✅ {t('accept')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          
          {availableTotalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              {[...Array(availableTotalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setAvailablePage(i + 1)}
                  style={{
                    width: 'auto',
                    padding: '5px 12px',
                    background: availablePage === i + 1 ? '#667eea' : '#f0f0f0',
                    color: availablePage === i + 1 ? 'white' : '#666',
                    borderRadius: '20px',
                    fontSize: '0.8rem'
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'my' && (
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '1.25rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
        }}>
          {myShipments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
              📦 {t('no_my_shipments')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {myShipments.map(shipment => (
                <div key={shipment.id} style={{
                  background: '#fafbfc',
                  borderRadius: '16px',
                  padding: '1rem',
                  border: '1px solid #eef2f6'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                        <strong style={{ fontSize: '1rem' }}>#{shipment.id}</strong>
                        <StatusBadge status={shipment.status} />
                        {shipment.is_urgent === 1 && (
                          <span style={{ background: '#ff9800', color: 'white', padding: '2px 8px', borderRadius: '20px', fontSize: '0.6rem' }}>🚀</span>
                        )}
                      </div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: '#555' }}>
                        📍 {shipment.pickup_address.split(',')[0]} → {shipment.delivery_address.split(',')[0]}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.7rem', color: '#999' }}>
                        💰 {shipment.price} RSD {shipment.weight_kg && `• ⚖️ ${shipment.weight_kg} kg`}
                      </p>
                    </div>
                  </div>
                  
                  {shipment.status === 'delivered' && !reviewedClientShipments.has(shipment.id) && (
                    <button
                      onClick={() => {
                        setSelectedShipmentForClientReview(shipment)
                        setShowClientReviewModal(true)
                      }}
                      style={{
                        marginTop: '8px',
                        padding: '4px 12px',
                        fontSize: '0.8rem',
                        background: '#17a2b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '20px',
                        cursor: 'pointer'
                      }}
                    >
                      ⭐ {t('rate_client')}
                    </button>
                  )}
                  
                  {shipment.qr_code && (
                    <details style={{ marginTop: '8px' }}>
                      <summary style={{ fontSize: '0.7rem', cursor: 'pointer', color: '#667eea' }}>
                        🔲 {t('show_qr_driver')}
                      </summary>
                      <div style={{ textAlign: 'center', marginTop: '8px' }}>
                        <img 
                          src={shipment.qr_code} 
                          alt="QR Code" 
                          style={{ width: '100px', height: '100px' }}
                        />
                      </div>
                    </details>
                  )}
                  
                  <div style={{ marginTop: '1rem' }}>
                    <Chat key={`${shipment.id}-${activeTab}`} shipment={shipment} currentUser={user} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showScanner && (
        <QrScanner
          onScan={handleQrScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {editingShipment && (
        <EditShipmentModal
          shipment={editingShipment}
          onClose={() => setEditingShipment(null)}
          onSuccess={() => {
            fetchData()
            setEditingShipment(null)
          }}
        />
      )}

      {showSignaturePad && (
        <SignaturePad
          onSave={handleCompleteDelivery}
          onClose={() => setShowSignaturePad(false)}
        />
      )}

      {showClientReviewModal && selectedShipmentForClientReview && (
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
            <h3 style={{ marginBottom: '1rem', color: '#667eea' }}>⭐ {t('rate_client_title')}</h3>
            <p>{t('shipment')} #{selectedShipmentForClientReview.id}</p>
            <p style={{ color: '#666', fontSize: '0.8rem', marginBottom: '1rem' }}>
              {selectedShipmentForClientReview.pickup_address} → {selectedShipmentForClientReview.delivery_address}
            </p>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>{t('rating')} (1-5):</label>
              <RatingStars rating={clientRating} onRatingChange={setClientRating} size={32} />
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>{t('comment_optional')}:</label>
              <textarea
                value={clientComment}
                onChange={(e) => setClientComment(e.target.value)}
                rows={3}
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  borderRadius: '8px', 
                  border: '1px solid #ddd',
                  resize: 'vertical'
                }}
                placeholder={t('comment_placeholder')}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button 
                onClick={() => setShowClientReviewModal(false)} 
                style={{ background: '#dc3545', flex: 1 }}
              >
                {t('cancel')}
              </button>
              <button 
                onClick={() => handleRateClient(selectedShipmentForClientReview)}
                style={{ flex: 1 }}
              >
                {t('submit_rating')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DashboardDriver
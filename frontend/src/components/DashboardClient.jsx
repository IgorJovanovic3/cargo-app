import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import Notifications from './Notifications'
import ReviewModal from '../components/ReviewModal'
import Chat from '../components/Chat'
import Pagination from './Pagination'
import EditShipmentModal from './EditShipmentModal'
import RatingHistogram from './RatingHistogram'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { useTranslation } from 'react-i18next'

// Fix za marker ikone u Leaflet-u
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

function DashboardClient() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [shipments, setShipments] = useState([])
  const [selectedShipment, setSelectedShipment] = useState(null)
  const [driverLocation, setDriverLocation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [followDriver, setFollowDriver] = useState(true)
  const [selectedShipmentForReview, setSelectedShipmentForReview] = useState(null)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewedShipments, setReviewedShipments] = useState(new Set())
  const [filterStatus, setFilterStatus] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showEditModal, setShowEditModal] = useState(false)
  const [shipmentToEdit, setShipmentToEdit] = useState(null)
  const [clientRating, setClientRating] = useState(null)
  const mapRef = useRef(null)

  const exportToExcel = () => {
    const data = shipments.map(s => ({
      [t('excel_id')]: s.id,
      [t('excel_from')]: s.pickup_address,
      [t('excel_to')]: s.delivery_address,
      [t('excel_description')]: s.cargo_description,
      [t('excel_weight')]: s.weight_kg || '',
      [t('excel_dimensions')]: s.dimensions || '',
      [t('excel_price')]: s.price,
      [t('excel_status')]: t(s.status),
      [t('excel_urgent')]: s.is_urgent ? t('yes') : t('no'),
      [t('excel_date')]: new Date(s.created_at).toLocaleString('sr-RS')
    }))
    
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, t('excel_sheet_name'))
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' })
    saveAs(blob, `${t('excel_filename')}_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  useEffect(() => {
    if (!user) return
    
    const fetchShipments = async () => {
      setLoading(true)
      try {
        const res = await api.get('/shipments/client/', {
          params: {
            status: filterStatus || undefined,
            page: currentPage,
            limit: 10,
            search: searchTerm || undefined,
            sort: sortBy
          }
        })
        setShipments(res.data.shipments)
        setTotalPages(res.data.total_pages)
        
        const reviewedSet = new Set()
        for (const shipment of res.data.shipments) {
          if (shipment.status === 'delivered') {
            try {
              const checkRes = await api.get(`/reviews/can-review/${shipment.id}`)
              if (!checkRes.data.can_review) {
                reviewedSet.add(shipment.id)
              }
            } catch (err) {
              console.error(err)
            }
          }
        }
        
        setReviewedShipments(reviewedSet)
        setLoading(false)
      } catch (err) {
        console.error(err)
        setLoading(false)
      }
    }
    
    fetchShipments()
  }, [user, filterStatus, currentPage, searchTerm, sortBy])

  useEffect(() => {
    if (!user || user.user_type !== 'client') return
    
    const fetchClientRating = async () => {
      try {
        const res = await api.get(`/reviews/client/${user.id}`)
        setClientRating(res.data)
      } catch (err) {
        console.error(err)
      }
    }
    
    fetchClientRating()
  }, [user])

  useEffect(() => {
    if (!user || !selectedShipment) return
    
    const activeStatuses = ['accepted', 'picked_up', 'in_transit']
    if (!activeStatuses.includes(selectedShipment.status)) {
      setDriverLocation(null)
      return
    }

    const ws = new WebSocket(`ws://localhost:8000/ws/client/${user.id}`)
    
    ws.onopen = () => console.log('✅ WebSocket connected as client')
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'driver_location' && data.shipment_id === selectedShipment.id) {
          setDriverLocation({ lat: data.lat, lng: data.lng })
          if (followDriver && mapRef.current) {
            mapRef.current.flyTo([data.lat, data.lng], mapRef.current.getZoom())
          }
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err)
      }
    }
    ws.onerror = (error) => console.error('WebSocket error:', error)
    ws.onclose = () => console.log('WebSocket closed')
    
    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
    }
  }, [user, selectedShipment, followDriver])

  const handleSelectShipment = (shipment) => {
    setSelectedShipment(shipment)
    setDriverLocation(null)
    setFollowDriver(true)
  }

  const getStatusColor = (status) => {
    const colors = {
      pending: '#ffc107',
      accepted: '#17a2b8',
      picked_up: '#007bff',
      in_transit: '#6f42c1',
      delivered: '#28a745',
      cancelled: '#dc3545'
    }
    return colors[status] || '#6c757d'
  }

  const isAlreadyReviewed = (shipmentId) => reviewedShipments.has(shipmentId)

  const downloadQrCode = (qrCode, shipmentId) => {
    const link = document.createElement('a')
    link.href = qrCode
    link.download = `qr_posiljka_${shipmentId}.png`
    link.click()
  }

  const handleEditShipment = (shipment) => {
    setShipmentToEdit(shipment)
    setShowEditModal(true)
  }

  if (loading) return <div className="loading">{t('loading')}</div>

  const isActiveShipment = selectedShipment && 
    ['accepted', 'picked_up', 'in_transit'].includes(selectedShipment.status)

  const statusOptions = {
    '': t('all_statuses'),
    'pending': t('pending'),
    'accepted': t('accepted'),
    'picked_up': t('picked_up'),
    'in_transit': t('in_transit'),
    'delivered': t('delivered'),
    'cancelled': t('cancelled')
  }

  const sortOptions = {
    'newest': t('newest_first'),
    'oldest': t('oldest_first'),
    'price_asc': t('price_ascending'),
    'price_desc': t('price_descending')
  }

  return (
    <div className="dashboard-client">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>{t('client_dashboard')}</h1>
        <button 
          onClick={exportToExcel}
          style={{ width: 'auto', background: '#28a745', padding: '8px 16px' }}
        >
          📊 {t('export_excel')}
        </button>
      </div>
      
      {clientRating && clientRating.total_reviews > 0 && (
        <div style={{ 
          background: 'white', 
          borderRadius: '16px', 
          padding: '1rem', 
          marginBottom: '1rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0 }}>⭐ {t('my_rating')}: {clientRating.average_rating}/5</h3>
              <p style={{ margin: '4px 0 0', color: '#666', fontSize: '0.8rem' }}>
                {t('based_on')} {clientRating.total_reviews} {t('driver_ratings')}
              </p>
            </div>
            <div style={{ fontSize: '1.5rem' }}>
              {'★'.repeat(Math.round(clientRating.average_rating))}
              {'☆'.repeat(5 - Math.round(clientRating.average_rating))}
            </div>
          </div>
          <RatingHistogram histogram={clientRating.histogram} totalReviews={clientRating.total_reviews} />
        </div>
      )}
      
      <div className="dashboard-grid">
        <div className="shipments-list">
          <h2>📦 {t('my_shipments')}</h2>
          
          <div className="filters">
            <select 
              value={filterStatus} 
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1) }}
            >
              {Object.entries(statusOptions).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            
            <input
              type="text"
              placeholder="🔍 Pretraga po adresi..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
            />
            
            <select 
              value={sortBy} 
              onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1) }}
            >
              {Object.entries(sortOptions).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          
          {shipments.length === 0 ? (
            <p>{t('no_shipments')} <a href="/nova-posiljka">{t('create_new')}</a></p>
          ) : (
            shipments.map(shipment => (
              <div 
                key={shipment.id} 
                className={`shipment-card ${selectedShipment?.id === shipment.id ? 'selected' : ''}`}
                onClick={() => handleSelectShipment(shipment)}
                style={{ borderLeft: `4px solid ${getStatusColor(shipment.status)}` }}
              >
                <p><strong>#{shipment.id}</strong></p>
                <p>📍 {shipment.pickup_address.substring(0, 35)} → {shipment.delivery_address.substring(0, 35)}</p>
                <p>{t('status')}: <span className={`status ${shipment.status}`}>{t(shipment.status)}</span></p>
                <p>💰 {shipment.price} RSD</p>
                {shipment.is_urgent === 1 && <span style={{ color: '#ff9800', fontSize: '0.7rem' }}>🚀 {t('urgent')}</span>}
                {shipment.weight_kg && <p>⚖️ {t('weight')}: {shipment.weight_kg} kg</p>}
                {shipment.dimensions && <p>📦 {t('dimensions')}: {shipment.dimensions}</p>}
                
                {shipment.status === 'pending' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditShipment(shipment)
                    }}
                    style={{
                      marginTop: '8px',
                      padding: '4px 12px',
                      fontSize: '0.8rem',
                      background: '#ffc107',
                      color: '#333',
                      border: 'none',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      marginRight: '8px'
                    }}
                  >
                    ✏️ {t('edit')}
                  </button>
                )}
                
                {shipment.signature && (
                  <details style={{ marginTop: '8px' }}>
                    <summary style={{ fontSize: '0.7rem', cursor: 'pointer', color: '#28a745' }}>
                      ✍️ {t('delivery_confirmation')}
                    </summary>
                    <div style={{ textAlign: 'center', marginTop: '8px' }}>
                      <img 
                        src={shipment.signature} 
                        alt="Potpis" 
                        style={{ width: '150px', border: '1px solid #ddd', borderRadius: '8px' }}
                      />
                      <p style={{ fontSize: '0.6rem', color: '#666', marginTop: '4px' }}>
                        {t('date')}: {new Date(shipment.signature_date).toLocaleString('sr-RS')}
                      </p>
                    </div>
                  </details>
                )}
                
                {shipment.qr_code && (
                  <details style={{ marginTop: '8px' }}>
                    <summary style={{ fontSize: '0.7rem', cursor: 'pointer', color: '#667eea' }}>
                      🔲 {t('show_qr')}
                    </summary>
                    <div style={{ textAlign: 'center', marginTop: '8px' }}>
                      <img 
                        src={shipment.qr_code} 
                        alt="QR Code" 
                        style={{ width: '100px', height: '100px' }}
                      />
                      <div style={{ marginTop: '8px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            downloadQrCode(shipment.qr_code, shipment.id)
                          }}
                          style={{
                            width: 'auto',
                            padding: '4px 12px',
                            fontSize: '0.7rem',
                            background: '#28a745'
                          }}
                        >
                          📥 {t('download_qr')}
                        </button>
                      </div>
                      <p style={{ fontSize: '0.6rem', color: '#666', marginTop: '4px' }}>
                        {t('qr_instruction')}
                      </p>
                    </div>
                  </details>
                )}
                
                {shipment.status === 'delivered' && !isAlreadyReviewed(shipment.id) && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      setSelectedShipmentForReview(shipment)
                      setShowReviewModal(true)
                    }}
                    style={{
                      marginTop: '8px',
                      padding: '4px 12px',
                      fontSize: '0.8rem',
                      background: '#ffc107',
                      color: '#333',
                      border: 'none',
                      borderRadius: '20px',
                      cursor: 'pointer'
                    }}
                  >
                    ⭐ {t('rate_driver')}
                  </button>
                )}
              </div>
            ))
          )}
          
          {totalPages > 1 && (
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </div>

        <div className="tracking-area">
          <div className="map-container">
            <h2>🗺️ {t('tracking')}</h2>
            {selectedShipment ? (
              <>
                {isActiveShipment && driverLocation ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setFollowDriver(!followDriver)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.8rem',
                          background: followDriver ? '#667eea' : '#ccc',
                          color: 'white',
                          border: 'none',
                          borderRadius: '20px',
                          cursor: 'pointer'
                        }}
                      >
                        {followDriver ? '🔍 ' + t('follow_on') : '📍 ' + t('follow_off')}
                      </button>
                    </div>
                    <MapContainer
                      center={[driverLocation.lat, driverLocation.lng]}
                      zoom={14}
                      style={{ height: '350px', width: '100%', borderRadius: '12px', marginBottom: '1rem' }}
                      ref={mapRef}
                    >
                      <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                      />
                      <Marker position={[selectedShipment.pickup_lat, selectedShipment.pickup_lng]}>
                        <Popup>📍 {t('pickup')}</Popup>
                      </Marker>
                      <Marker position={[selectedShipment.delivery_lat, selectedShipment.delivery_lng]}>
                        <Popup>🏁 {t('delivery')}</Popup>
                      </Marker>
                      <Marker position={[driverLocation.lat, driverLocation.lng]}>
                        <Popup>🚚 {t('driver_here')}</Popup>
                      </Marker>
                      <Polyline
                        positions={[
                          [selectedShipment.pickup_lat, selectedShipment.pickup_lng],
                          [selectedShipment.delivery_lat, selectedShipment.delivery_lng]
                        ]}
                        color="#667eea"
                        weight={3}
                        opacity={0.5}
                      />
                    </MapContainer>
                  </>
                ) : (
                  <div className="map-placeholder">
                    {!isActiveShipment ? (
                      <p>⏳ {t('tracking_available_after_accept')}</p>
                    ) : (
                      <p>🔄 {t('waiting_for_driver')}</p>
                    )}
                  </div>
                )}
                
                <div className="shipment-details">
                  <h3>📋 {t('shipment_details')} #{selectedShipment.id}</h3>
                  <p><strong>📍 {t('from')}:</strong> {selectedShipment.pickup_address}</p>
                  <p><strong>🏁 {t('to')}:</strong> {selectedShipment.delivery_address}</p>
                  <p><strong>📦 {t('description')}:</strong> {selectedShipment.cargo_description}</p>
                  {selectedShipment.weight_kg && <p><strong>⚖️ {t('weight')}:</strong> {selectedShipment.weight_kg} kg</p>}
                  {selectedShipment.dimensions && <p><strong>📦 {t('dimensions')}:</strong> {selectedShipment.dimensions}</p>}
                  <p><strong>📌 {t('status')}:</strong> <span className={`status ${selectedShipment.status}`}>{t(selectedShipment.status)}</span></p>
                  <p><strong>💰 {t('price')}:</strong> {selectedShipment.price} RSD</p>
                  {selectedShipment.is_urgent === 1 && <p><strong>🚀 {t('urgent_delivery')}</strong></p>}
                  
                  {selectedShipment.status === 'pending' && (
                    <button
                      onClick={() => handleEditShipment(selectedShipment)}
                      style={{
                        marginTop: '1rem',
                        padding: '8px 16px',
                        background: '#ffc107',
                        color: '#333',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        width: '100%'
                      }}
                    >
                      ✏️ {t('edit_shipment')}
                    </button>
                  )}
                  
                  {selectedShipment.signature && (
                    <div style={{ textAlign: 'center', marginTop: '1rem', padding: '1rem', background: '#f0f4ff', borderRadius: '12px' }}>
                      <p><strong>✍️ {t('delivery_confirmation')}</strong></p>
                      <img 
                        src={selectedShipment.signature} 
                        alt="Potpis" 
                        style={{ width: '200px', border: '1px solid #ddd', borderRadius: '8px' }}
                      />
                      <p style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.5rem' }}>
                        {t('received')}: {new Date(selectedShipment.signature_date).toLocaleString('sr-RS')}
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p>{t('select_shipment')}</p>
            )}
          </div>
          
          {selectedShipment && (
            <div style={{ marginTop: '1rem' }}>
              <Chat shipment={selectedShipment} currentUser={user} />
            </div>
          )}
          
          <div className="notifications-area" style={{ marginTop: '1rem' }}>
            <h2>🔔 {t('notifications')}</h2>
            <Notifications userId={user?.id} userType="client" />
          </div>
        </div>
      </div>

      {showEditModal && shipmentToEdit && (
        <EditShipmentModal
          shipment={shipmentToEdit}
          onClose={() => {
            setShowEditModal(false)
            setShipmentToEdit(null)
          }}
          onSuccess={() => {
            setShowEditModal(false)
            setShipmentToEdit(null)
            window.location.reload()
          }}
        />
      )}

      <ReviewModal
        shipment={selectedShipmentForReview}
        isOpen={showReviewModal}
        onClose={() => {
          setShowReviewModal(false)
          setSelectedShipmentForReview(null)
        }}
        onSuccess={() => {
          alert('⭐ ' + t('thank_you_review'))
          if (selectedShipmentForReview) {
            setReviewedShipments(prev => new Set([...prev, selectedShipmentForReview.id]))
          }
          setShowReviewModal(false)
          setSelectedShipmentForReview(null)
        }}
      />
    </div>
  )
}

export default DashboardClient
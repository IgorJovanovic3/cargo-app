import { useState, useEffect, useRef } from 'react'
import api from '../services/api'

function NotificationBell({ userId }) {
  const [notifications, setNotifications] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef(null)

  const fetchNotifications = async () => {
    if (!userId) return
    try {
      const res = await api.get('/notifications/')
      console.log('📩 Dohvaćene notifikacije:', res.data)
      setNotifications(res.data)
      const count = res.data.filter(n => !n.is_read).length
      setUnreadCount(count)
      console.log(`🔔 Nepročitanih: ${count}`)
    } catch (err) {
      console.error('Greška:', err)
    }
  }

  useEffect(() => {
    if (!userId) return
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 3000)
    return () => clearInterval(interval)
  }, [userId])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const markAsRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`)
      fetchNotifications()
    } catch (err) {
      console.error(err)
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/mark-all-read')
      fetchNotifications()
    } catch (err) {
      console.error(err)
    }
  }

  const getIcon = (type) => {
    if (type?.includes('accepted')) return '✅'
    if (type?.includes('picked_up')) return '📦'
    if (type?.includes('in_transit')) return '🚚'
    if (type?.includes('delivered')) return '🏁'
    if (type?.includes('cancelled')) return '❌'
    return '🔔'
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={dropdownRef}>
      <button
        onClick={() => {
          setShowDropdown(!showDropdown)
          fetchNotifications()
        }}
        style={{
          background: 'none',
          border: 'none',
          fontSize: '1.5rem',
          cursor: 'pointer',
          position: 'relative',
          padding: '0.5rem'
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            background: '#dc3545',
            color: 'white',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            fontSize: '0.7rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: '40px',
          width: '380px',
          maxHeight: '450px',
          overflowY: 'auto',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          zIndex: 1000,
          border: '1px solid #e0e0e0'
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'white',
            borderRadius: '12px 12px 0 0'
          }}>
            <strong>🔔 Notifikacije</strong>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} style={{
                fontSize: '0.7rem',
                padding: '4px 10px',
                background: '#f0f0f0',
                border: 'none',
                borderRadius: '20px',
                cursor: 'pointer'
              }}>
                Označi sve
              </button>
            )}
          </div>
          
          {notifications.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
              Nema notifikacija
            </div>
          ) : (
            notifications.map(notif => (
              <div
                key={notif.id}
                onClick={() => markAsRead(notif.id)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #f0f0f0',
                  cursor: 'pointer',
                  background: notif.is_read ? 'white' : '#f0f4ff'
                }}
              >
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ fontSize: '1.2rem' }}>{getIcon(notif.type)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: notif.is_read ? 'normal' : 'bold' }}>
                      {notif.title}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#555' }}>
                      {notif.message}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#999', marginTop: '4px' }}>
                      {new Date(notif.created_at).toLocaleString('sr-RS')}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell
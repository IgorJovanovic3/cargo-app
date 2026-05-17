import { useState, useEffect, useRef } from 'react'
import api from '../services/api'

function NotificationBell({ userId }) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const wsRef = useRef(null)

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications/')
      setNotifications(res.data)
      const unread = res.data.filter(n => !n.is_read).length
      setUnreadCount(unread)
    } catch (err) {
      console.error('Greška pri dohvatanju notifikacija:', err)
    }
  }

  useEffect(() => {
    if (!userId) return

    fetchNotifications()

    // WebSocket za real-time notifikacije
    const WS_URL = window.location.protocol === 'https:' 
      ? 'wss://cargo-backend-mqx7.onrender.com' 
      : 'ws://localhost:8000'
    
    const ws = new WebSocket(`${WS_URL}/ws/notifications/${userId}`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'new_notification') {
          // Dodaj novu notifikaciju na početak liste
          setNotifications(prev => [data.notification, ...prev])
          setUnreadCount(prev => prev + 1)
          
          // Zvuk za notifikaciju
          const audio = new Audio('/notification.mp3')
          audio.play().catch(e => console.log('Audio error:', e))
        }
      } catch (err) {
        console.error('WebSocket notifikacija error:', err)
      }
    }

    return () => {
      if (wsRef.current) wsRef.current.close()
    }
  }, [userId])

  const markAsRead = async (notificationId) => {
    try {
      await api.post(`/notifications/${notificationId}/read`)
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: 1 } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error(err)
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/mark-all-read')
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })))
      setUnreadCount(0)
    } catch (err) {
      console.error(err)
    }
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'new_message': return '💬'
      case 'status_change': return '📦'
      case 'new_shipment': return '➕'
      case 'shipment_accepted': return '✅'
      default: return '🔔'
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none',
          border: 'none',
          fontSize: '1.3rem',
          cursor: 'pointer',
          position: 'relative',
          padding: '6px 8px',
          borderRadius: '40px',
          width: 'auto'
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: '#ff4757',
            color: 'white',
            borderRadius: '50%',
            padding: '2px 6px',
            fontSize: '0.6rem',
            minWidth: '16px',
            textAlign: 'center'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 998
            }}
            onClick={() => setIsOpen(false)}
          />
          <div style={{
            position: 'absolute',
            top: '45px',
            right: '0',
            width: '320px',
            maxHeight: '400px',
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            zIndex: 999,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #eef2f6',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontWeight: 'bold' }}>🔔 Notifikacije</span>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  style={{
                    width: 'auto',
                    padding: '4px 12px',
                    fontSize: '0.7rem',
                    background: '#667eea',
                    borderRadius: '20px'
                  }}
                >
                  Označi sve kao pročitano
                </button>
              )}
            </div>
            <div style={{ overflowY: 'auto', maxHeight: '350px' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                  📭 Nema notifikacija
                </div>
              ) : (
                notifications.map(notif => (
                  <div
                    key={notif.id}
                    onClick={() => markAsRead(notif.id)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #eef2f6',
                      cursor: 'pointer',
                      background: notif.is_read ? 'white' : '#f0f4ff',
                      transition: 'background 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '1.2rem' }}>{getNotificationIcon(notif.type)}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: notif.is_read ? 'normal' : 'bold', fontSize: '0.85rem' }}>
                          {notif.title}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '4px' }}>
                          {notif.message}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: '#999', marginTop: '4px' }}>
                          {new Date(notif.created_at).toLocaleString('sr-RS')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default NotificationBell
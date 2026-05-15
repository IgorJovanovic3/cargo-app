import { useEffect, useState } from 'react'
import api from '../services/api'

function Notifications({ userId, userType }) {
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await api.get('/notifications/')
        setNotifications(res.data)
      } catch (err) {
        console.error(err)
      }
    }
    
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 10000)
    
    return () => clearInterval(interval)
  }, [])

  if (notifications.length === 0) {
    return <p>Nema novih notifikacija</p>
  }

  return (
    <div className="notifications-list">
      {notifications.map((n, idx) => (
        <div key={idx} className="notification">
          <p><strong>{n.title}</strong></p>
          <p>{n.message}</p>
          <small>{new Date(n.created_at).toLocaleString('sr-RS')}</small>
        </div>
      ))}
    </div>
  )
}

export default Notifications
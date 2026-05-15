import { useState, useEffect, useRef } from 'react'
import api from '../services/api'

function Chat({ shipment, currentUser }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [ws, setWs] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef(null)

  // Dohvati poruke i postavi WebSocket
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await api.get(`/chat/messages/${shipment.id}`)
        setMessages(res.data)
        const unread = res.data.filter(m => !m.is_read && m.sender_id !== currentUser.id).length
        setUnreadCount(unread)
      } catch (err) {
        console.error('Greška pri dohvatanju poruka:', err)
      }
    }
    
    fetchMessages()

    const socket = new WebSocket(`ws://localhost:8000/chat/ws/${shipment.id}/${currentUser.id}`)
    
    socket.onopen = () => console.log('💬 Chat WebSocket connected')
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'new_message') {
        setMessages(prev => [...prev, {
          id: Date.now(),
          sender_id: data.sender_id,
          sender_name: data.sender_name,
          message: data.message,
          created_at: data.timestamp,
          is_read: 0
        }])
        
        if (data.sender_id !== currentUser.id) {
          setUnreadCount(prev => prev + 1)
          
          // Browser notifikacija
          if (Notification.permission === 'granted') {
            new Notification('💬 Nova poruka', {
              body: `${data.sender_name || 'Neko'} vam je poslao poruku za pošiljku #${shipment.id}`
            })
          }
        }
      }
    }
    
    socket.onerror = (error) => console.error('Chat WebSocket error:', error)
    socket.onclose = () => console.log('💬 Chat WebSocket closed')
    
    setWs(socket)
    
    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close()
      }
    }
  }, [shipment.id, currentUser.id])

  // Označi poruke kao pročitane
  const markMessagesAsRead = async () => {
    if (unreadCount > 0) {
      try {
        await api.post(`/chat/mark-read/${shipment.id}`)
        setUnreadCount(0)
        setMessages(prev => prev.map(m => ({ ...m, is_read: 1 })))
      } catch (err) {
        console.error(err)
      }
    }
  }

  // Auto-scroll na dno
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = () => {
    if (!newMessage.trim() || !ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'message', message: newMessage }))
    setNewMessage('')
  }

  // Zahtev za dozvolu za notifikacije
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  return (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      height: '350px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      border: '1px solid #eef2f6'
    }}>
      <div 
        onClick={markMessagesAsRead}
        style={{
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer'
        }}
      >
        <span>💬 Chat o pošiljci #{shipment.id}</span>
        {unreadCount > 0 && (
          <span style={{
            background: '#ff4757',
            borderRadius: '20px',
            padding: '2px 10px',
            fontSize: '0.7rem'
          }}>
            {unreadCount} novih
          </span>
        )}
      </div>
      
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
            Nema poruka. Započnite razgovor!
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                alignSelf: msg.sender_id === currentUser.id ? 'flex-end' : 'flex-start',
                background: msg.sender_id === currentUser.id ? '#667eea' : '#f0f4ff',
                color: msg.sender_id === currentUser.id ? 'white' : '#333',
                padding: '8px 12px',
                borderRadius: '12px',
                maxWidth: '70%',
                wordBreak: 'break-word'
              }}
            >
              <div style={{ fontSize: '0.7rem', marginBottom: '4px', opacity: 0.7 }}>
                {msg.sender_name || (msg.sender_id === currentUser.id ? 'Vi' : 'Vozač')}
              </div>
              <div>{msg.message}</div>
              <div style={{ fontSize: '0.6rem', marginTop: '4px', opacity: 0.7 }}>
                {new Date(msg.created_at).toLocaleTimeString('sr-RS')}
                {!msg.is_read && msg.sender_id !== currentUser.id && (
                  <span style={{ marginLeft: '8px', color: '#667eea' }}>●</span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div style={{ padding: '12px', borderTop: '1px solid #eef2f6', display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Napišite poruku..."
          style={{
            flex: 1,
            padding: '10px 12px',
            border: '1px solid #eef2f6',
            borderRadius: '24px',
            outline: 'none'
          }}
        />
        <button onClick={sendMessage} style={{ width: 'auto', padding: '8px 20px', borderRadius: '24px' }}>
          Pošalji
        </button>
      </div>
    </div>
  )
}

export default Chat
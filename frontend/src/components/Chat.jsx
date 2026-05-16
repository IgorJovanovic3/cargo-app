import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../services/api'

const WS_URL = window.location.protocol === 'https:' 
  ? 'wss://cargo-backend-mqx7.onrender.com' 
  : 'ws://localhost:8000'

// Zvuk za notifikacije (Web Audio API)
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.value = 880
    gainNode.gain.value = 0.2
    
    oscillator.start()
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.3)
    oscillator.stop(audioContext.currentTime + 0.3)
    
    setTimeout(() => audioContext.close(), 400)
  } catch(e) {
    console.log('Audio error:', e)
  }
}

function Chat({ shipment, currentUser }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [ws, setWs] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const messagesEndRef = useRef(null)
  const wsRef = useRef(null)
  
  // Čuvamo trenutni shipment ID da bismo filterisali poruke
  const currentShipmentIdRef = useRef(shipment?.id)

  const fetchMessages = useCallback(async () => {
    if (!shipment?.id) return
    try {
      const res = await api.get(`/chat/messages/${shipment.id}`)
      setMessages(res.data)
      const unread = res.data.filter(m => !m.is_read && m.sender_id !== currentUser?.id).length
      setUnreadCount(unread)
    } catch (err) {
      console.error('Greška:', err)
    }
  }, [shipment?.id, currentUser?.id])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // WebSocket konekcija
  useEffect(() => {
    if (!shipment?.id || !currentUser?.id) return

    // Ažuriramo trenutni shipment ID
    currentShipmentIdRef.current = shipment.id

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close()
    }

    const socket = new WebSocket(`${WS_URL}/chat/ws/${shipment.id}/${currentUser.id}`)
    wsRef.current = socket
    
    socket.onopen = () => {
      console.log(`✅ Chat CONNECTED - shipment ${shipment.id}`)
      setIsConnected(true)
    }
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log(`📨 Primljena poruka:`, data)
        
        // 🔥 FILTER: Prikazujemo SAMO poruke za trenutni shipment
        const messageShipmentId = data.shipment_id || shipment.id
        
        if (messageShipmentId !== currentShipmentIdRef.current) {
          console.log(`❌ IGNORIŠEM poruku za drugu pošiljku ${messageShipmentId} (trenutni: ${currentShipmentIdRef.current})`)
          return
        }
        
        if (data.type === 'new_message') {
          // Ignorišemo sopstvene poruke
          if (data.sender_id === currentUser.id) {
            console.log(`⏭️ Ignorišem sopstvenu poruku`)
            return
          }
          
          console.log(`✅ PRIMAM poruku za shipment ${shipment.id}`)
          
          const newMsg = {
            id: data.message_id || Date.now(),
            sender_id: data.sender_id,
            sender_name: data.sender_name,
            message: data.message,
            created_at: data.timestamp || new Date().toISOString(),
            is_read: 0
          }
          
          setMessages(prev => [...prev, newMsg])
          setUnreadCount(prev => prev + 1)
          
          // 🔔 ZVUK
          playNotificationSound()
          
          // Browser notifikacija
          if (Notification.permission === 'granted') {
            new Notification('💬 Nova poruka', {
              body: `${data.sender_name || 'Neko'} vam je poslao poruku za pošiljku #${shipment.id}`
            })
          }
        }
        
      } catch (err) {
        console.error('Error:', err)
      }
    }
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
      setIsConnected(false)
    }
    
    socket.onclose = () => {
      console.log(`❌ Chat DISCONNECTED - shipment ${shipment.id}`)
      setIsConnected(false)
    }
    
    setWs(socket)
    
    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close()
      }
    }
  }, [shipment?.id, currentUser?.id])

  const markMessagesAsRead = async () => {
    if (unreadCount > 0 && shipment?.id) {
      try {
        await api.post(`/chat/mark-read/${shipment.id}`)
        setUnreadCount(0)
        setMessages(prev => prev.map(m => ({ ...m, is_read: 1 })))
      } catch (err) {
        console.error(err)
      }
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = () => {
    if (!newMessage.trim()) return
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      alert('Nema veze sa serverom')
      return
    }
    
    const messageText = newMessage.trim()
    
    // Optimistic update - odmah prikaži sopstvenu poruku
    const tempMessage = {
      id: Date.now(),
      sender_id: currentUser.id,
      sender_name: currentUser.full_name,
      message: messageText,
      created_at: new Date().toISOString(),
      is_read: 1
    }
    
    setMessages(prev => [...prev, tempMessage])
    setNewMessage('')
    
    ws.send(JSON.stringify({ type: 'message', message: messageText }))
  }

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
      border: '1px solid #eef2f6',
      marginBottom: '16px'
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
        <span>💬 Chat o pošiljci #{shipment?.id}</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!isConnected && (
            <span style={{ background: '#ff4757', borderRadius: '20px', padding: '2px 8px', fontSize: '0.6rem' }}>
              🔌 offline
            </span>
          )}
          {unreadCount > 0 && (
            <span style={{ background: '#ff4757', borderRadius: '20px', padding: '2px 10px', fontSize: '0.7rem' }}>
              {unreadCount} novih
            </span>
          )}
        </div>
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
            💬 Nema poruka. Započnite razgovor!
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={msg.id || idx}
              style={{
                alignSelf: msg.sender_id === currentUser?.id ? 'flex-end' : 'flex-start',
                background: msg.sender_id === currentUser?.id ? '#667eea' : '#f0f4ff',
                color: msg.sender_id === currentUser?.id ? 'white' : '#333',
                padding: '8px 12px',
                borderRadius: '12px',
                maxWidth: '70%',
                wordBreak: 'break-word'
              }}
            >
              <div style={{ fontSize: '0.7rem', marginBottom: '4px', opacity: 0.7 }}>
                {msg.sender_name || (msg.sender_id === currentUser?.id ? 'Vi' : 'Vozač')}
              </div>
              <div>{msg.message}</div>
              <div style={{ fontSize: '0.6rem', marginTop: '4px', opacity: 0.7 }}>
                {new Date(msg.created_at).toLocaleTimeString('sr-RS')}
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
          placeholder={isConnected ? "Napišite poruku..." : "Čekam konekciju..."}
          disabled={!isConnected}
          style={{
            flex: 1,
            padding: '10px 12px',
            border: '1px solid #eef2f6',
            borderRadius: '24px',
            outline: 'none',
            background: isConnected ? 'white' : '#f5f5f5'
          }}
        />
        <button 
          onClick={sendMessage} 
          disabled={!isConnected}
          style={{ 
            width: 'auto', 
            padding: '8px 20px', 
            borderRadius: '24px',
            opacity: isConnected ? 1 : 0.5
          }}
        >
          Pošalji
        </button>
      </div>
    </div>
  )
}

export default Chat
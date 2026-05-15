import { useAuth } from '../context/AuthContext'
import DashboardClient from '../components/DashboardClient'
import DashboardDriver from '../components/DashboardDriver'
import { Navigate } from 'react-router-dom'

function Dashboard() {
  const { user, loading } = useAuth()
  
  if (loading) return <div className="loading">Učitavanje...</div>
  if (!user) return <Navigate to="/login" />
  
  console.log('Ulogovani korisnik:', user)
  console.log('Tip korisnika:', user.user_type)
  
  if (user.user_type === 'driver') {
    return <DashboardDriver />
  }
  
  if (user.user_type === 'client') {
    return <DashboardClient />
  }
  
  // Admin se preusmerava na admin panel
  if (user.user_type === 'admin') {
    return <Navigate to="/admin" />
  }
  
  return <DashboardClient />
}

export default Dashboard
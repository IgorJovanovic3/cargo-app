import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import AdminPricing from '../components/AdminPricing'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title
} from 'chart.js'
import { Pie, Line, Bar } from 'react-chartjs-2'

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title
)

function AdminDashboard() {
  const { user, loading } = useAuth()
  const { t } = useTranslation()
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [shipments, setShipments] = useState([])
  const [activeTab, setActiveTab] = useState('stats')
  const [dataLoading, setDataLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [shipmentsByMonth, setShipmentsByMonth] = useState(null)
  const [earningsByMonth, setEarningsByMonth] = useState(null)
  const [statusStats, setStatusStats] = useState(null)

  useEffect(() => {
    if (user?.user_type !== 'admin') return
    fetchAllData()
    fetchChartData()
  }, [user])

  const fetchAllData = async () => {
    try {
      const [statsRes, usersRes, shipmentsRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
        api.get('/admin/shipments')
      ])
      setStats(statsRes.data)
      setUsers(usersRes.data)
      setShipments(shipmentsRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setDataLoading(false)
    }
  }

  const fetchChartData = async () => {
    try {
      const [shipmentsRes, earningsRes, statusRes] = await Promise.all([
        api.get('/admin/stats/shipments-by-month'),
        api.get('/admin/stats/earnings-by-month'),
        api.get('/admin/stats/by-status')
      ])
      setShipmentsByMonth(shipmentsRes.data)
      setEarningsByMonth(earningsRes.data)
      setStatusStats(statusRes.data)
    } catch (err) {
      console.error(err)
    }
  }

  const blockUser = async (userId) => {
    if (window.confirm(t('block_confirm'))) {
      await api.put(`/admin/users/${userId}/block`)
      fetchAllData()
    }
  }

  const activateUser = async (userId) => {
    await api.put(`/admin/users/${userId}/activate`)
    fetchAllData()
  }

  const deleteShipment = async (shipmentId) => {
    if (window.confirm(t('delete_confirm'))) {
      await api.delete(`/admin/shipments/${shipmentId}`)
      fetchAllData()
    }
  }

  const exportShipments = () => {
    let url = '/admin/export/shipments/excel'
    const params = []
    if (statusFilter) params.push(`status=${statusFilter}`)
    if (dateFrom) params.push(`date_from=${dateFrom}`)
    if (dateTo) params.push(`date_to=${dateTo}`)
    if (params.length) url += '?' + params.join('&')
    window.location.href = url
  }

  if (loading || dataLoading) return <div className="loading">{t('loading')}</div>
  
  if (!user || user.user_type !== 'admin') {
    return <Navigate to="/dashboard" />
  }

  const statusOptions = {
    '': t('all_statuses'),
    'pending': t('pending'),
    'accepted': t('accepted'),
    'picked_up': t('picked_up'),
    'in_transit': t('in_transit'),
    'delivered': t('delivered'),
    'cancelled': t('cancelled')
  }

  const statusMap = {
    'pending': 'Na čekanju',
    'accepted': 'Prihvaćeno',
    'picked_up': 'Preuzeto',
    'in_transit': 'U transportu',
    'delivered': 'Dostavljeno',
    'cancelled': 'Otkazano'
  }

  return (
    <div className="admin-dashboard">
      <h1>{t('admin_dashboard')}</h1>
      
      <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '12px' }}>
        <h4>{t('export_filters')}</h4>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '8px', borderRadius: '8px' }}>
            {Object.entries(statusOptions).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder={t('from_date')} />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder={t('to_date')} />
          <button onClick={exportShipments} style={{ background: '#28a745' }}>📊 {t('export_excel')}</button>
        </div>
      </div>
      
      <div className="admin-tabs">
        <button onClick={() => setActiveTab('stats')} className={activeTab === 'stats' ? 'active' : ''}>
          📊 {t('statistics')}
        </button>
        <button onClick={() => setActiveTab('users')} className={activeTab === 'users' ? 'active' : ''}>
          👥 {t('users')} ({users.length})
        </button>
        <button onClick={() => setActiveTab('shipments')} className={activeTab === 'shipments' ? 'active' : ''}>
          📦 {t('shipments')} ({shipments.length})
        </button>
        <button onClick={() => setActiveTab('pricing')} className={activeTab === 'pricing' ? 'active' : ''}>
          💰 {t('pricing')}
        </button>
      </div>

      {activeTab === 'stats' && stats && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>👥 {t('users')}</h3>
              <p>{t('total')} <strong>{stats.users.total}</strong></p>
              <p>{t('clients')} {stats.users.clients}</p>
              <p>{t('drivers')} {stats.users.drivers}</p>
              <p>{t('active_drivers')} {stats.users.active_drivers}</p>
            </div>
            <div className="stat-card">
              <h3>📦 {t('shipments')}</h3>
              <p>{t('total')} <strong>{stats.shipments.total}</strong></p>
              <p>{t('pending')} {stats.shipments.pending}</p>
              <p>{t('in_transit')} {stats.shipments.in_transit}</p>
              <p>{t('delivered')} {stats.shipments.delivered}</p>
              <p>{t('last_7_days')} {stats.shipments.last_7_days}</p>
            </div>
            <div className="stat-card">
              <h3>💰 {t('earnings')}</h3>
              <p>{t('total_earnings')} <strong>{stats.earnings.total_rsd} RSD</strong></p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
            
            {shipmentsByMonth && shipmentsByMonth.labels && shipmentsByMonth.labels.length > 0 && (
              <div style={{ background: 'white', borderRadius: '20px', padding: '1rem' }}>
                <h3>📦 Pošiljke po mesecima</h3>
                <Line
                  data={{
                    labels: shipmentsByMonth.labels,
                    datasets: [{
                      label: 'Broj pošiljki',
                      data: shipmentsByMonth.data,
                      borderColor: '#667eea',
                      backgroundColor: 'rgba(102, 126, 234, 0.1)',
                      tension: 0.4,
                      fill: true
                    }]
                  }}
                  options={{ responsive: true, maintainAspectRatio: true }}
                />
              </div>
            )}
            
            {earningsByMonth && earningsByMonth.labels && earningsByMonth.labels.length > 0 && (
              <div style={{ background: 'white', borderRadius: '20px', padding: '1rem' }}>
                <h3>💰 Zarada po mesecima (RSD)</h3>
                <Bar
                  data={{
                    labels: earningsByMonth.labels,
                    datasets: [{
                      label: t('earnings_chart_label'),
                      data: earningsByMonth.data,
                      backgroundColor: '#28a745',
                      borderRadius: 8
                    }]
                  }}
                  options={{ responsive: true, maintainAspectRatio: true }}
                />
              </div>
            )}
            
            {statusStats && Object.keys(statusStats).length > 0 && (
              <div style={{ background: 'white', borderRadius: '20px', padding: '1rem' }}>
                <h3>📊 Statusi pošiljki</h3>
                <Pie
                  data={{
                    labels: Object.keys(statusStats).map(s => statusMap[s] || s),
                    datasets: [{
                      data: Object.values(statusStats),
                      backgroundColor: ['#ffc107', '#17a2b8', '#007bff', '#6f42c1', '#28a745', '#dc3545'],
                      borderWidth: 0
                    }]
                  }}
                  options={{ responsive: true, maintainAspectRatio: true }}
                />
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'users' && (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>{t('email')}</th>
                <th>{t('full_name')}</th>
                <th>{t('user_type')}</th>
                <th>{t('status')}</th>
                <th>{t('company')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.email}</td>
                  <td>{u.full_name}</td>
                  <td>{u.user_type === 'client' ? t('client') : u.user_type === 'driver' ? t('driver') : 'Admin'}</td>
                  <td>{u.is_active ? '✅ ' + t('active') : '❌ ' + t('blocked')}</td>
                  <td>{u.is_company ? '🏢 ' + t('yes') : '👤 ' + t('no')}</td>
                  <td>
                    {u.user_type !== 'admin' && (
                      <>
                        {u.is_active ? (
                          <button onClick={() => blockUser(u.id)} className="danger">{t('block')}</button>
                        ) : (
                          <button onClick={() => activateUser(u.id)} className="success">{t('activate')}</button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'shipments' && (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>{t('from')}</th>
                <th>{t('to')}</th>
                <th>{t('status')}</th>
                <th>{t('price')}</th>
                <th>{t('archived')}</th>
                <th>PDF</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map(s => (
                <tr key={s.id}>
                  <td>#{s.id}</td>
                  <td>{s.pickup_address.substring(0, 30)}</td>
                  <td>{s.delivery_address.substring(0, 30)}</td>
                  <td><span className={`status ${s.status}`}>{t(s.status)}</span></td>
                  <td>{s.price} RSD</td>
                  <td>{s.is_deleted ? '✅ ' + t('yes') : '❌ ' + t('no')}</td>
                  <td>
                    <a href={`/admin/export/shipment/pdf/${s.id}`} target="_blank" rel="noopener noreferrer">
                      <button style={{ background: '#dc3545', padding: '4px 8px', fontSize: '0.7rem' }}>📄 PDF</button>
                    </a>
                  </td>
                  <td><button onClick={() => deleteShipment(s.id)} className="danger">{t('delete')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'pricing' && <AdminPricing />}
    </div>
  )
}

export default AdminDashboard
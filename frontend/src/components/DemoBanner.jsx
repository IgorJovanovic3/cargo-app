import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function DemoBanner() {
  const { demo } = useAuth()
  if (!demo?.enabled) return null
  return (
    <aside style={{ background: '#eef2ff', borderBottom: '1px solid #c7d2fe', padding: '.7rem 1rem', color: '#312e81', textAlign: 'center', fontSize: '.88rem' }}>
      <strong>Portfolio demo</strong> · Shared fictional data · Resets when the server restarts · Simulated driver location<br />
      <span>Please use fictional shipment details. </span>
      <Link to="/login">Switch role</Link> · <a href="https://github.com/IgorJovanovic3/cargo-app" target="_blank" rel="noreferrer">View Python / React source</a>
    </aside>
  )
}

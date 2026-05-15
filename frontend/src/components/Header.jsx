import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'
import { useTranslation } from 'react-i18next'

function Header() {
  const { user, logout } = useAuth()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng)
  }

  return (
    <header className="header">
      <div className="logo">
        <Link to="/">{t('app_name')}</Link>
      </div>
      <nav className="nav">
        {user ? (
          <>
            <span>Dobrodošli, {user.full_name}</span>
            <span>({user.user_type === 'client' ? t('klijent') : user.user_type === 'driver' ? t('vozac') : 'Admin'})</span>
            <NotificationBell userId={user.id} />
            {user.user_type === 'client' && (
              <Link to="/nova-posiljka">{t('nova_posiljka')}</Link>
            )}
            {user.user_type === 'admin' && (
              <Link to="/admin">{t('admin_panel')}</Link>
            )}
            <Link to="/dashboard">{t('dashboard')}</Link>
            <button onClick={handleLogout}>{t('odjavi_se')}</button>
            
            {/* Jezički switcher */}
            <div style={{ display: 'flex', gap: '5px', marginLeft: '10px' }}>
              <button 
                onClick={() => changeLanguage('sr')}
                style={{ 
                  background: i18n.language === 'sr' ? '#667eea' : '#555',
                  padding: '4px 8px',
                  fontSize: '0.8rem',
                  width: 'auto'
                }}
              >
                🇷🇸 SR
              </button>
              <button 
                onClick={() => changeLanguage('en')}
                style={{ 
                  background: i18n.language === 'en' ? '#667eea' : '#555',
                  padding: '4px 8px',
                  fontSize: '0.8rem',
                  width: 'auto'
                }}
              >
                🇬🇧 EN
              </button>
            </div>
          </>
        ) : (
          <>
            <Link to="/login">{t('prijava')}</Link>
            <Link to="/register">{t('registracija')}</Link>
            
            {/* Jezički switcher i za neregistrovane korisnike */}
            <div style={{ display: 'flex', gap: '5px', marginLeft: '10px' }}>
              <button 
                onClick={() => changeLanguage('sr')}
                style={{ 
                  background: i18n.language === 'sr' ? '#667eea' : '#555',
                  padding: '4px 8px',
                  fontSize: '0.8rem',
                  width: 'auto'
                }}
              >
                🇷🇸 SR
              </button>
              <button 
                onClick={() => changeLanguage('en')}
                style={{ 
                  background: i18n.language === 'en' ? '#667eea' : '#555',
                  padding: '4px 8px',
                  fontSize: '0.8rem',
                  width: 'auto'
                }}
              >
                🇬🇧 EN
              </button>
            </div>
          </>
        )}
      </nav>
    </header>
  )
}

export default Header
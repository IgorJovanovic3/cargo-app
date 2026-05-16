import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'

function Header() {
  const { user, logout } = useAuth()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng)
    setMobileMenuOpen(false)
  }

  return (
    <>
      <header className="header" style={styles.header}>
        <div className="logo" style={styles.logo}>
          <Link to="/" style={styles.logoLink}>
            🚚 {t('app_name')}
          </Link>
        </div>

        {/* Hamburger dugme - samo na mobilnom/tabletu */}
        <button 
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={styles.mobileMenuBtn}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>

        {/* Navigacija - desktop i mobile */}
        <nav 
          className={`nav ${mobileMenuOpen ? 'mobile-open' : ''}`}
          style={{
            ...styles.nav,
            ...(mobileMenuOpen ? styles.navMobile : {})
          }}
        >
          {user ? (
            <>
              <div style={styles.userInfo}>
                <span style={styles.userName}>
                  👋 {user.full_name?.split(' ')[0] || user.full_name}
                </span>
                <span style={styles.userBadge}>
                  {user.user_type === 'client' && '👤 ' + t('klijent')}
                  {user.user_type === 'driver' && '🚚 ' + t('vozac')}
                  {user.user_type === 'admin' && '🛡️ Admin'}
                </span>
              </div>

              <div style={styles.navLinks}>
                <NotificationBell userId={user.id} />
                
                {user.user_type === 'client' && (
                  <Link to="/nova-posiljka" style={styles.navLink} onClick={() => setMobileMenuOpen(false)}>
                    ➕ {t('nova_posiljka')}
                  </Link>
                )}
                
                {user.user_type === 'admin' && (
                  <Link to="/admin" style={styles.navLink} onClick={() => setMobileMenuOpen(false)}>
                    🛡️ {t('admin_panel')}
                  </Link>
                )}
                
                <Link to="/dashboard" style={styles.navLink} onClick={() => setMobileMenuOpen(false)}>
                  📊 {t('dashboard')}
                </Link>
              </div>

              <div style={styles.rightGroup}>
                {/* Jezički switcher */}
                <div style={styles.languageSwitcher}>
                  <button 
                    onClick={() => changeLanguage('sr')}
                    style={{
                      ...styles.langBtn,
                      background: i18n.language === 'sr' ? '#667eea' : '#f0f0f0',
                      color: i18n.language === 'sr' ? 'white' : '#333'
                    }}
                  >
                    🇷🇸
                  </button>
                  <button 
                    onClick={() => changeLanguage('en')}
                    style={{
                      ...styles.langBtn,
                      background: i18n.language === 'en' ? '#667eea' : '#f0f0f0',
                      color: i18n.language === 'en' ? 'white' : '#333'
                    }}
                  >
                    🇬🇧
                  </button>
                </div>

                {/* Logout dugme */}
                <button onClick={handleLogout} style={styles.logoutBtn}>
                  🚪 {t('odjavi_se')}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={styles.navLinks}>
                <Link to="/login" style={styles.navLink} onClick={() => setMobileMenuOpen(false)}>
                  🔐 {t('prijava')}
                </Link>
                <Link to="/register" style={styles.navLink} onClick={() => setMobileMenuOpen(false)}>
                  📝 {t('registracija')}
                </Link>
              </div>
              
              <div style={styles.languageSwitcher}>
                <button 
                  onClick={() => changeLanguage('sr')}
                  style={{
                    ...styles.langBtn,
                    background: i18n.language === 'sr' ? '#667eea' : '#f0f0f0',
                    color: i18n.language === 'sr' ? 'white' : '#333'
                  }}
                >
                  🇷🇸
                </button>
                <button 
                  onClick={() => changeLanguage('en')}
                  style={{
                    ...styles.langBtn,
                    background: i18n.language === 'en' ? '#667eea' : '#f0f0f0',
                    color: i18n.language === 'en' ? 'white' : '#333'
                  }}
                >
                  🇬🇧
                </button>
              </div>
            </>
          )}
        </nav>
      </header>

      {/* Ako je mobile menu otvoren, klik bilo gde zatvara */}
      {mobileMenuOpen && (
        <div 
          style={styles.overlay}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  )
}

// ==================== STILOVI ====================

const styles = {
  header: {
    background: 'white',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    padding: '12px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
  },
  logo: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
  },
  logoLink: {
    color: '#667eea',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  mobileMenuBtn: {
    display: 'none',
    background: '#667eea',
    border: 'none',
    color: 'white',
    fontSize: '24px',
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    cursor: 'pointer',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap',
  },
  navMobile: {
    position: 'fixed',
    top: '60px',
    left: 0,
    right: 0,
    background: 'white',
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: '20px',
    gap: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    zIndex: 1001,
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#f8f9ff',
    padding: '6px 14px',
    borderRadius: '40px',
  },
  userName: {
    fontWeight: '600',
    color: '#333',
    fontSize: '0.85rem',
  },
  userBadge: {
    fontSize: '0.7rem',
    color: '#667eea',
    background: '#e8eaff',
    padding: '2px 8px',
    borderRadius: '20px',
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  navLink: {
    textDecoration: 'none',
    color: '#555',
    fontSize: '0.85rem',
    padding: '6px 8px',
    borderRadius: '8px',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
  },
  rightGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  languageSwitcher: {
    display: 'flex',
    gap: '6px',
  },
  langBtn: {
    border: 'none',
    borderRadius: '20px',
    padding: '6px 12px',
    fontSize: '0.75rem',
    cursor: 'pointer',
    fontWeight: '500',
    width: 'auto',
    minWidth: '45px',
  },
  logoutBtn: {
    background: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '40px',
    padding: '6px 16px',
    fontSize: '0.8rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
    width: 'auto',
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.3)',
    zIndex: 999,
  },
}

// Dodajemo media query za responsive (preko CSS ili inline)
// Ovo dodajemo u <style> tag
const styleSheet = document.createElement("style")
styleSheet.textContent = `
  @media (max-width: 900px) {
    .mobile-menu-btn {
      display: flex !important;
    }
    .nav {
      display: none !important;
    }
    .nav.mobile-open {
      display: flex !important;
    }
    .nav-links, .right-group {
      flex-direction: column !important;
      width: 100% !important;
    }
    .nav-links a, .right-group button {
      width: 100% !important;
      text-align: center !important;
      justify-content: center !important;
    }
    .user-info {
      justify-content: center !important;
    }
    .language-switcher {
      justify-content: center !important;
    }
    .logo {
      font-size: 1rem !important;
    }
  }
  
  @media (min-width: 901px) {
    .nav {
      display: flex !important;
    }
  }
  
  /* Hover efekti */
  .nav-link:hover {
    background: #f0f4ff !important;
    color: #667eea !important;
  }
  
  .logout-btn:hover {
    background: #c82333 !important;
    transform: scale(1.02) !important;
  }
  
  .lang-btn:hover {
    transform: scale(1.05) !important;
  }
`
document.head.appendChild(styleSheet)

export default Header
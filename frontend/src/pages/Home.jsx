import { Link } from 'react-router-dom'

function Home() {
  return (
    <div className="home">
      <h1>Cargo App</h1>
      <p>Platforma za transport robe</p>
      <div className="buttons">
        <Link to="/login">
          <button>Uloguj se</button>
        </Link>
        <Link to="/register">
          <button>Registruj se</button>
        </Link>
      </div>
    </div>
  )
}

export default Home
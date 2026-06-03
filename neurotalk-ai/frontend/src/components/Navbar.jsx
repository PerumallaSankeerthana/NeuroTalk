import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">NeuroTalk AI</Link>
      </div>
      <div className="navbar-links">
        {!user ? (
          <>
            <Link to="/login" className="nav-link">Login</Link>
            <Link to="/signup" className="nav-btn">Sign Up</Link>
          </>
        ) : (
          <>
            {user.role !== 'admin' ? (
              <>
                <Link to="/dashboard" className="nav-link">Dashboard</Link>
                <Link to="/chat" className="nav-link">Chat</Link>
                <Link to="/history" className="nav-link">History</Link>
                <Link to="/profile" className="nav-link">Profile</Link>
              </>
            ) : (
              <Link to="/admin" className="nav-link admin-link">
                <span style={{ backgroundColor: '#dc2626', color: 'white', padding: '4px 10px', borderRadius: '16px', fontSize: '0.85rem', fontWeight: 'bold' }}>Admin Panel</span>
              </Link>
            )}
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

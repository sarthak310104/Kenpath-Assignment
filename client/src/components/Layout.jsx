import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Top bar + page container for every page you see after logging in.
function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isDoctor = user?.role === 'doctor';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <>
      <header className="navbar">
        <div className="navbar-inner">
          <span className="brand">Sweety</span>

          <nav className="nav-links">
            {isDoctor ? (
              <NavLink to="/patients">Patients</NavLink>
            ) : (
              <>
                <NavLink to="/dashboard">Readings</NavLink>
                <NavLink to="/reports">Reports</NavLink>
              </>
            )}
          </nav>

          <div className="nav-user">
            {isDoctor && <span className="badge">Doctor</span>}
            <span className="nav-name">{user?.name}</span>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={handleLogout}
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="page">
        <Outlet />
      </main>
    </>
  );
}

export default Layout;
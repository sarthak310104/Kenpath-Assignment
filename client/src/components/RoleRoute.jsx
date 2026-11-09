import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Only lets the given role ("patient" or "doctor") see the pages inside.
// Anyone else is sent to their own home page.
function RoleRoute({ role }) {
  const { user } = useAuth();

  if (user.role === role) {
    return <Outlet />;
  }

  return <Navigate to={user.role === 'doctor' ? '/patients' : '/dashboard'} replace />;
}

export default RoleRoute;
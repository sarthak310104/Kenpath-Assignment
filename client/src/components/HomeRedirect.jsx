import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// "/" sends doctors to their patients and everyone else to their readings.
function HomeRedirect() {
  const { user } = useAuth();

  return <Navigate to={user.role === 'doctor' ? '/patients' : '/dashboard'} replace />;
}

export default HomeRedirect;
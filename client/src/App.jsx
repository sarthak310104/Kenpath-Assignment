import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';
import HomeRedirect from './components/HomeRedirect';
import Layout from './components/Layout';

import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import DoctorPatients from './pages/DoctorPatients';
import PatientReports from './pages/PatientReports';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomeRedirect />} />

            <Route element={<Layout />}>
              <Route element={<RoleRoute role="patient" />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/reports" element={<Reports />} />
              </Route>

              <Route element={<RoleRoute role="doctor" />}>
                <Route path="/patients" element={<DoctorPatients />} />
                <Route path="/patients/:id" element={<PatientReports />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
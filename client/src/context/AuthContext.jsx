import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

import { authAPI } from '../api/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      const token = localStorage.getItem('token');

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await authAPI.getMe();
        setUser(data.user);
      } catch (error) {
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  async function login(credentials) {
    const data = await authAPI.login(credentials);

    localStorage.setItem('token', data.token);
    setUser(data.user);

    return data;
  }

  async function register(userData) {
    const data = await authAPI.register(userData);

    // a doctor waiting for approval gets no token yet
    if (data.token) {
      localStorage.setItem('token', data.token);
      setUser(data.user);
    }

    return data;
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
  }

  // change a few fields of the logged-in user (for example their doctor)
  function updateUser(changes) {
    setUser((current) => ({ ...current, ...changes }));
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        updateUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
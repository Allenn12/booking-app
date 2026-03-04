import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../api/client';
import { flushSync } from 'react-dom';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, []);

  /**
   * checkSession - Verify user has valid session
   * 
   * WHY PUBLIC METHOD:
   * - Can be called from anywhere (e.g., after verification)
   * - Refreshes auth state
   */
  const [businesses, setBusinesses] = useState([]);

  async function checkSession() {
    try {
      const response = await api.checkSession();
      setUser(response.user);
      setBusinesses(response.businesses || []);

      if (response.flash) {
        const { type, message } = response.flash;
        if (type === 'success') toast.success(message);
        else if (type === 'error') toast.error(message);
        else toast.info(message);
      }
    } catch (error) {
      setUser(null);
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }

  async function login(credentials) {
    const response = await api.login(credentials);
    if (response.success) {
      await checkSession();
      return response;
    }
    else if (!response.success && response.code === 'EMAIL_NOT_VERIFIED') {
      setUser({ ...response.user, authenticated: false })
      return response;
    }
    throw new Error(response.message || 'Login failed');
  }

  async function register(userData) {
    const response = await api.register(userData);
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Registration failed');
  }

  async function logout() {
    await api.logout();
    // 1. Navigate to the Home page first (which is now safely a NeutralRoute)
    navigate('/');

    // 2. Delay clearing the user state so ProtectedRoute doesn't panic and
    //    redirect to /login before the unmount finishes.
    setTimeout(() => {
      setUser(null);
      setBusinesses([]);
      toast.success('Logged out successfully');
    }, 10);
  }

  return (
    <AuthContext.Provider value={{
      user,
      businesses,
      login,
      register,
      logout,
      loading,
      checkSession
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

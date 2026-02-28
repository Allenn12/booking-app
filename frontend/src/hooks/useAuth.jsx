import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

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
  async function checkSession() {
    try {
      console.log('🔍 Checking session...');
      
      // Try to get user businesses (ako ima session, uspjet će)
      const response = await api.checkSession();
      setUser(response.user);
      console.log('✅ Session valid', response.user.email);
    } catch (error) {
      // Nema sessiona
      console.log('❌ No session:', error.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(credentials) {
    const response = await api.login(credentials);
    if (response.success) {
      setUser({ authenticated: true });
      return response;
    }
    else if(!response.success && response.code === 'EMAIL_NOT_VERIFIED'){
      setUser({authenticated: false})
      return response;
    }
    throw new Error(response.error);
  }

  async function register(userData) {
    const response = await api.register(userData);
    if (response.success) {
      return response;
    }
    throw new Error(response.error);
  }

  async function logout() {
    await api.logout();
    setUser(null);
    navigate('/login');
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      register, 
      logout, 
      loading,
      checkSession // ⭐ Expose checkSession method!
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

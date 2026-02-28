import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

/**
 * PublicRoute Guard
 * 
 * PURPOSE: Protect public pages (login, register) from authenticated users
 * 
 * LOGIC:
 * - If user is authenticated → Redirect to dashboard (they don't need login page)
 * - If user is NOT authenticated → Show the public page (login/register)
 * 
 * USAGE:
 * <PublicRoute>
 *   <LoginPage />
 * </PublicRoute>
 */
function PublicRoute({ children }) {
  // 1. Get user authentication state from context
  const { user, loading } = useAuth();
  
  // 2. LOADING STATE
  // WHY: Session check is async (API call)
  // We must wait before deciding to redirect or show page
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Checking session...
      </div>
    );
  }
  
  // 3. USER AUTHENTICATED → Redirect to dashboard
  // WHY: User is already logged in, no need to see login page
  if (user) {
    console.log('✅ PublicRoute: User authenticated, redirecting to /dashboard');
    return <Navigate to="/dashboard" replace />;
  }
  
  // 4. USER NOT AUTHENTICATED → Show public page
  // WHY: User needs to login/register, show them the form
  console.log('ℹ️ PublicRoute: User not authenticated, showing public page');
  return children;
}

export default PublicRoute;

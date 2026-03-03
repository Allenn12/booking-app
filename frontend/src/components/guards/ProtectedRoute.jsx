import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

/**
 * ProtectedRoute Guard
 * 
 * PURPOSE: Protect authenticated pages (dashboard, calendar) from non-authenticated users
 * 
 * LOGIC:
 * - If user is NOT authenticated → Redirect to login (they need to login first)
 * - If user is authenticated → Show the protected page (dashboard/calendar)
 * 
 * USAGE:
 * <ProtectedRoute>
 *   <Dashboard />
 * </ProtectedRoute>
 */
function ProtectedRoute({ children }) {
  // 1. Get user authentication state
  const { user, loading } = useAuth();

  // 2. LOADING STATE
  // Same reason as PublicRoute - avoid flash of wrong page
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
        Loading...
      </div>
    );
  }

  // 3. USER NOT AUTHENTICATED → Redirect to login
  // WHY: User needs to login before accessing protected pages
  if (!user) {
    console.log('❌ ProtectedRoute: User not authenticated, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  // 3.1. Email verification check
  if (user.verificationLevel !== 'active') {
    return <Navigate to="/verify-email" replace />;
  }

  // 4. Force business selection if authenticated but no context
  const isSpecialPath = ['/my-businesses', '/onboarding'].includes(location.pathname);

  // If no businesses at all, go to onboarding (unless already there)
  if (!user.hasBusinesses) {
    if (location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
    }
    return children; // Allow /onboarding
  }

  // If has businesses but none selected, go to selection (unless already there)
  if (!user.activeBusinessId && !isSpecialPath) {
    return <Navigate to="/my-businesses" replace />;
  }

  // 5. Role-based restriction: Only owner/admin for dashboard
  if (location.pathname === '/dashboard' && user.role === 'employee') {
    return <Navigate to="/appointments" replace />;
  }

  // WHY: User has valid session, allow access
  console.log('✅ ProtectedRoute: User authenticated and has business, showing protected page');
  return children;
}

export default ProtectedRoute;

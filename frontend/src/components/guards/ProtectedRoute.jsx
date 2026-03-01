import { Navigate } from 'react-router-dom';
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

  if (user.verificationLevel !== 'active') {
    return <Navigate to="/verify-email" replace />;
  }

  // ⭐ REDIRECT TO ONBOARDING IF NO BUSINESSES
  if (!user.hasBusinesses) {
    console.log('⚠️ ProtectedRoute: User has no business, redirecting to /onboarding');
    return <Navigate to="/onboarding" replace />;
  }

  // 4. USER AUTHENTICATED → Show protected page
  // WHY: User has valid session, allow access
  console.log('✅ ProtectedRoute: User authenticated and has business, showing protected page');
  return children;
}

export default ProtectedRoute;

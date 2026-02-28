import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function PublicRoute({ children }) {
  // TODO: Dohvati user i loading iz useAuth hook-a
  const { user, loading } = useAuth();
  
  // TODO: Ako je loading, prikaži "Loading..."
  if (loading) {
    return <div>Loading...</div>;
  }
  
  // TODO: Ako user postoji (authenticated), redirect na /dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  
  // TODO: Ako user NE postoji, prikaži children (LoginPage)
  return children;
}

export default PublicRoute;

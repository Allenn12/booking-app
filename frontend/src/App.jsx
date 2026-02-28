import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './hooks/useAuth';
import { AppRoutes } from './routes'; // ⭐ Import centralized routes

/**
 * App Component - Application Root
 * 
 * STRUCTURE:
 * 1. HelmetProvider - SEO meta tags management
 * 2. BrowserRouter - React Router (enables routing)
 * 3. AuthProvider - Authentication context (user state)
 * 4. AppRoutes - All application routes (centralized)
 * 
 * WHY CLEAN:
 * - No route definitions here (all in routes/index.jsx)
 * - Clear separation of concerns
 * - Easy to understand application structure
 */
function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes /> {/* ⭐ All routes handled here! */}
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
}

export default App;

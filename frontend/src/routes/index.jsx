import { Routes, Route } from 'react-router-dom';
import PublicRoute from '../components/guards/PublicRoute';
import ProtectedRoute from '../components/guards/ProtectedRoute';
import NeutralRoute from '../components/guards/NeutralRoute';
import MainLayout from '../components/layout/MainLayout';

// ============================================
// IMPORT ALL PAGES
// ============================================

// Public pages
import HomePage from '../pages/public/HomePage';
import LoginPage from '../pages/public/LoginPage';
import RegisterPage from '../pages/public/RegisterPage';
import VerifyEmailPage from '../pages/public/VerifyEmailPage';
import EmailVerifiedPage from '../pages/public/EmailVerifiedPage';

// Authenticated pages
import Dashboard from '../pages/app/Dashboard';
import Calendar from '../pages/app/Calendar';
import Appointments from '../pages/app/Appointments';
import MyBusinesses from '../pages/app/MyBusinesses';
import OnboardingPage from '../pages/app/OnboardingPage';
import CreateJoinBusiness from '../pages/app/CreateJoinBusiness';

// Business Pages
import Overview from '../pages/app/business/Overview';
import Services from '../pages/app/business/Services';
import Team from '../pages/app/business/Team';

// ============================================
// ROUTE CONFIGURATION
// ============================================

/**
 * Route Configuration Object
 * 
 * WHY:
 * - Centralizirano: Sve rute u jednom mjestu
 * - Easy to maintain: Dodaj rutu u array
 * - Type-safe: Možeš dodati TypeScript types
 * 
 * STRUCTURE:
 * {
 *   path: string       - URL path
 *   component: React.Component - Page component
 * }
 */

export const routeConfig = {
  // Public routes (accessible without authentication)
  public: [
    { path: '/login', component: LoginPage },
    { path: '/register', component: RegisterPage },
  ],

  neutral: [
    { path: '/', component: HomePage },
    { path: '/verify-email', component: VerifyEmailPage },
    { path: '/onboarding', component: OnboardingPage },
  ],

  // Protected routes (require authentication)
  protected: [
    {
      path: '/dashboard',
      component: Dashboard
    },
    {
      path: '/calendar',
      component: Calendar
    },
    {
      path: '/appointments',
      component: Appointments
    },
    {
      path: '/my-businesses',
      component: MyBusinesses
    },
    {
      path: '/create-join',
      component: CreateJoinBusiness
    },
    {
      path: '/business/overview',
      component: Overview
    },
    {
      path: '/business/services',
      component: Services
    },
    {
      path: '/business/team',
      component: Team
    }
  ]
};

// ============================================
// AppRoutes COMPONENT
// ============================================

/**
 * AppRoutes Component
 * 
 * PURPOSE: Generate all application routes from configuration
 * 
 * HOW IT WORKS:
 * 1. Map over routeConfig.public array
 * 2. For each route, create <Route> wrapped with <PublicRoute>
 * 3. Map over routeConfig.protected array
 * 4. For each route, create <Route> wrapped with <ProtectedRoute>
 * 
 * BENEFIT:
 * - To add new route: Just add to routeConfig array!
 * - Automatic guard wrapping
 * - No repetitive code
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* ================== PUBLIC ROUTES ================== */}
      {routeConfig.public.map(({ path, component: Component }) => (
        <Route
          key={path}                    // ← Unique key za React list rendering
          path={path}                   // ← URL path (/, /login, /register)
          element={                     // ← What to render
            <PublicRoute>               {/* ← Wrap sa PublicRoute guard */}
              <Component />             {/* ← Render page component */}
            </PublicRoute>
          }
        />
      ))}

      {/* ================== PROTECTED ROUTES ================== */}
      {routeConfig.protected.map(({ path, component: Component }) => (
        <Route
          key={path}
          path={path}
          element={
            <ProtectedRoute>
              <MainLayout>
                <Component />
              </MainLayout>
            </ProtectedRoute>
          }
        />
      ))}

      {/* ================== NEUTRAL ROUTES ================== */}
      {routeConfig.neutral.map(({ path, component: Component }) => (
        <Route
          key={path}
          path={path}
          element={
            <NeutralRoute>
              <Component />
            </NeutralRoute>}
        />
      ))}

    </Routes>
  );
}

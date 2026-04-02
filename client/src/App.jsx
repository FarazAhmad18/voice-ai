import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FirmProvider } from './context/FirmContext';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from 'sonner';
import { useTheme } from './context/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';

// Eagerly loaded (core pages — always needed)
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import LeadDetail from './pages/LeadDetail';

// Lazy loaded (secondary pages — loaded on demand)
const FollowUps = lazy(() => import('./pages/FollowUps'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Staff = lazy(() => import('./pages/Staff'));
const Settings = lazy(() => import('./pages/Settings'));
const Knowledge = lazy(() => import('./pages/Knowledge'));
const CalendarPage = lazy(() => import('./pages/Calendar'));
const Analytics = lazy(() => import('./pages/Analytics'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const ClientList = lazy(() => import('./pages/admin/ClientList'));
const ClientCreate = lazy(() => import('./pages/admin/ClientCreate'));
const ClientDetail = lazy(() => import('./pages/admin/ClientDetail'));
const TemplateList = lazy(() => import('./pages/admin/TemplateList'));
const Logs = lazy(() => import('./pages/admin/Logs'));
const Manual = lazy(() => import('./pages/admin/Manual'));

function ProtectedRoute({ children }) {
  const { isAuthenticated, isSuperAdmin, firm, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-[#09090b]">
        <div className="text-center">
          <div className="relative mx-auto w-12 h-12 mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-zinc-800" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-violet-500 animate-spin" />
          </div>
          <p className="text-sm text-slate-400 dark:text-zinc-500 animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const isClientRoute = !location.pathname.startsWith('/admin');
  if (isSuperAdmin && !firm && isClientRoute) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { isSuperAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isSuperAdmin) return <Navigate to="/" replace />;
  return children;
}

function AppLayout() {
  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-zinc-950 flex">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto px-6 py-6 md:pt-6 pt-20">
        <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-slate-900 dark:border-zinc-400 border-t-transparent rounded-full animate-spin" /></div>}>
          <Routes>
            {/* Client Dashboard */}
            <Route path="/" element={<Dashboard />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/leads/:id" element={<LeadDetail />} />
            <Route path="/follow-ups" element={<FollowUps />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/knowledge" element={<Knowledge />} />
            <Route path="/settings" element={<Settings />} />

            {/* Admin Panel */}
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/clients" element={<AdminRoute><ClientList /></AdminRoute>} />
            <Route path="/admin/clients/new" element={<AdminRoute><ClientCreate /></AdminRoute>} />
            <Route path="/admin/clients/:id" element={<AdminRoute><ClientDetail /></AdminRoute>} />
            <Route path="/admin/templates" element={<AdminRoute><TemplateList /></AdminRoute>} />
            <Route path="/admin/logs" element={<AdminRoute><Logs /></AdminRoute>} />
            <Route path="/admin/manual" element={<AdminRoute><Manual /></AdminRoute>} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

function ThemedToaster() {
  const { isDark } = useTheme();
  return <Toaster position="top-right" richColors closeButton theme={isDark ? 'dark' : 'light'} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <FirmProvider>
              <ThemedToaster />
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </FirmProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

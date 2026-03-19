import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FirmProvider } from './context/FirmContext';
import { Toaster } from 'sonner';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import LeadDetail from './pages/LeadDetail';
import FollowUps from './pages/FollowUps';
import Appointments from './pages/Appointments';
import Staff from './pages/Staff';
import Settings from './pages/Settings';
import Knowledge from './pages/Knowledge';
import AdminDashboard from './pages/admin/AdminDashboard';
import ClientList from './pages/admin/ClientList';
import ClientCreate from './pages/admin/ClientCreate';
import ClientDetail from './pages/admin/ClientDetail';
import TemplateList from './pages/admin/TemplateList';
import Logs from './pages/admin/Logs';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isSuperAdmin, firm, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
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
    <div className="min-h-screen bg-[#f8fafc]">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Routes>
          {/* Client Dashboard */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
          <Route path="/follow-ups" element={<FollowUps />} />
          <Route path="/appointments" element={<Appointments />} />
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
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <FirmProvider>
            <Toaster position="top-right" richColors closeButton />
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
    </ErrorBoundary>
  );
}

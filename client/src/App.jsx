import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FirmProvider } from './context/FirmContext';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import LeadDetail from './pages/LeadDetail';
import Appointments from './pages/Appointments';
import Settings from './pages/Settings';
import AdminDashboard from './pages/admin/AdminDashboard';
import ClientList from './pages/admin/ClientList';
import ClientCreate from './pages/admin/ClientCreate';
import ClientDetail from './pages/admin/ClientDetail';
import TemplateList from './pages/admin/TemplateList';
import Logs from './pages/admin/Logs';

const pageMeta = {
  '/': { title: 'Dashboard', subtitle: 'Overview of your practice' },
  '/leads': { title: 'Leads', subtitle: 'Manage incoming inquiries' },
  '/appointments': { title: 'Appointments', subtitle: 'Scheduled consultations' },
  '/settings': { title: 'Settings', subtitle: 'Firm configuration' },
  '/admin': { title: 'Admin', subtitle: 'Platform overview' },
  '/admin/clients': { title: 'Clients', subtitle: 'Manage your clients' },
  '/admin/clients/new': { title: 'New Client', subtitle: 'Create a new client' },
  '/admin/templates': { title: 'Templates', subtitle: 'Prompt templates' },
  '/admin/logs': { title: 'System Logs', subtitle: 'Monitor platform activity' },
};

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

  // Super admin with no firm visiting client routes → redirect to admin
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
  const location = useLocation();
  const isDetailPage = location.pathname.startsWith('/leads/');
  const isClientDetailPage = /^\/admin\/clients\/(?!new)[^/]+$/.test(location.pathname);

  let meta = pageMeta[location.pathname] || { title: 'LeapingAI' };
  if (isDetailPage) meta = { title: 'Lead Detail', subtitle: 'Client information' };
  if (isClientDetailPage) meta = { title: 'Client Detail', subtitle: 'Manage client' };

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title={meta.title} subtitle={meta.subtitle} />
        <main className="flex-1 p-8 overflow-auto">
          <Routes>
            {/* Client Dashboard */}
            <Route path="/" element={<Dashboard />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/leads/:id" element={<LeadDetail />} />
            <Route path="/appointments" element={<Appointments />} />
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
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FirmProvider>
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
  );
}

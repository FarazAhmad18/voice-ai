import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import LeadDetail from './pages/LeadDetail';
import Appointments from './pages/Appointments';
import Settings from './pages/Settings';

const pageMeta = {
  '/': { title: 'Dashboard', subtitle: 'Overview of your practice' },
  '/leads': { title: 'Leads', subtitle: 'Manage incoming inquiries' },
  '/appointments': { title: 'Appointments', subtitle: 'Scheduled consultations' },
  '/settings': { title: 'Settings', subtitle: 'Firm configuration' },
};

function AppLayout() {
  const location = useLocation();
  const meta = pageMeta[location.pathname] || { title: 'LawVoice AI' };
  const isDetailPage = location.pathname.startsWith('/leads/');

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          title={isDetailPage ? 'Lead Detail' : meta.title}
          subtitle={isDetailPage ? 'Client information' : meta.subtitle}
        />
        <main className="flex-1 p-8 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/leads/:id" element={<LeadDetail />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

import { useState } from 'react';
import { Search, Bell, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TopBar({ title, subtitle }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();

  const notifications = [
    { id: 1, type: 'hot', text: 'New hot lead: Sarah Johnson (Divorce)', time: '2m ago' },
    { id: 2, type: 'call', text: 'Call completed — Ali Raza, Child Custody', time: '15m ago' },
    { id: 3, type: 'booked', text: 'Appointment booked for tomorrow 3 PM', time: '1h ago' },
  ];

  function handleSearch(e) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/leads?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  }

  return (
    <header className="h-16 flex items-center justify-between px-8 border-b border-slate-100 bg-white/80 backdrop-blur-xl sticky top-0 z-30">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <form onSubmit={handleSearch} className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            type="text"
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-56 pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-200 placeholder:text-slate-300 transition-all"
          />
        </form>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <Bell size={18} className="text-slate-400" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-50">
                  <p className="text-sm font-semibold text-slate-800">Notifications</p>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.map((n) => (
                    <div key={n.id} className="px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                      <p className="text-sm text-slate-700">{n.text}</p>
                      <p className="text-xs text-slate-400 mt-1">{n.time}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User avatar */}
        <button className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl hover:bg-slate-50 transition-colors">
          <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center text-xs font-semibold text-white">
            ML
          </div>
          <ChevronDown size={14} className="text-slate-400" />
        </button>
      </div>
    </header>
  );
}

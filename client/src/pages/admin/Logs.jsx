import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchLogs, fetchFirms } from '../../services/api';
import {
  AlertTriangle, Info, AlertCircle, Bug, RefreshCw, Play, Pause,
  Download, Trash2, Search, ChevronDown, ChevronUp, Wifi, WifiOff,
  Terminal, Clock, Filter,
} from 'lucide-react';

const LEVELS = ['all', 'error', 'warn', 'info', 'debug'];
const TIME_RANGES = [
  { key: '1h', label: '1h' },
  { key: '6h', label: '6h' },
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
  { key: 'all', label: 'All' },
];

const CATEGORY_GROUPS = {
  'Voice Agent': ['retell_webhook', 'retell_api', 'tool_call'],
  'Lead Pipeline': ['lead', 'lead_scoring', 'intake', 'appointment'],
  'Messaging': ['sms', 'email'],
  'Integrations': ['crm_push', 'calendar'],
  'System': ['auth', 'admin', 'staff', 'system', 'database', 'prompt', 'settings', 'knowledge'],
};

const ALL_CATEGORIES = Object.values(CATEGORY_GROUPS).flat();

const CATEGORY_COLORS = {
  retell_webhook: '#a78bfa', retell_api: '#8b5cf6', tool_call: '#7c3aed',
  lead: '#3b82f6', lead_scoring: '#2563eb', intake: '#1d4ed8',
  appointment: '#06b6d4', calendar: '#0891b2',
  sms: '#10b981', email: '#059669',
  crm_push: '#f59e0b',
  auth: '#f97316', admin: '#ef4444', staff: '#ec4899',
  system: '#6b7280', database: '#64748b', prompt: '#8b5cf6',
  settings: '#94a3b8', knowledge: '#a855f7',
};

const LEVEL_COLORS = {
  error: { text: 'text-red-400', badge: 'bg-red-500/20 text-red-400 ring-red-500/30' },
  warn: { text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-400 ring-amber-500/30' },
  info: { text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-400 ring-blue-500/30' },
  debug: { text: 'text-slate-500 dark:text-zinc-500', badge: 'bg-slate-500/20 text-slate-500 dark:text-zinc-500 ring-slate-500/30' },
};

const LEVEL_ICONS = {
  error: AlertCircle,
  warn: AlertTriangle,
  info: Info,
  debug: Bug,
};

export default function Logs() {
  const [searchParams] = useSearchParams();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [errorCounts, setErrorCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [live, setLive] = useState(false);
  const [level, setLevel] = useState(searchParams.get('level') || 'all');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [timeRange, setTimeRange] = useState('24h');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [firmId, setFirmId] = useState('all');
  const [firms, setFirms] = useState([]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const logContainerRef = useRef(null);
  const categoryRef = useRef(null);
  const levelRef = useRef(null);
  const timeRef = useRef(null);
  const clientRef = useRef(null);

  useEffect(() => {
    fetchFirms().then(data => setFirms(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e) {
      if (categoryRef.current && !categoryRef.current.contains(e.target)) setCategoryOpen(false);
      if (levelRef.current && !levelRef.current.contains(e.target)) setLevelOpen(false);
      if (timeRef.current && !timeRef.current.contains(e.target)) setTimeOpen(false);
      if (clientRef.current && !clientRef.current.contains(e.target)) setClientOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const params = { limit: 100 };
      if (level !== 'all') params.level = level;
      if (category !== 'all') params.category = category;
      if (firmId !== 'all') params.firm_id = firmId;
      if (debouncedSearch) params.search = debouncedSearch;
      // Apply time range filter
      if (timeRange && timeRange !== 'all') {
        const now = new Date();
        if (timeRange === '1h') params.date_from = new Date(now - 3600000).toISOString();
        else if (timeRange === '24h') params.date_from = new Date(now - 86400000).toISOString();
        else if (timeRange === '7d') params.date_from = new Date(now - 7 * 86400000).toISOString();
        else if (timeRange === '30d') params.date_from = new Date(now - 30 * 86400000).toISOString();
      }
      const data = await fetchLogs(params);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setErrorCounts(data.error_counts || {});
    } catch (err) {
      // error handled by UI state
    } finally {
      setLoading(false);
    }
  }, [level, category, firmId, debouncedSearch, timeRange]);

  useEffect(() => {
    setLoading(true);
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!live) return;
    const interval = setInterval(loadLogs, 3000);
    return () => clearInterval(interval);
  }, [live, loadLogs]);

  function downloadLogs() {
    const text = logs.map(l =>
      `${new Date(l.created_at).toISOString()} [${l.level.toUpperCase()}] [${l.category}] ${l.message}${l.details ? ' ' + JSON.stringify(l.details) : ''}`
    ).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voibixai-logs-${new Date().toISOString().split('T')[0]}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalErrors = Object.values(errorCounts).reduce((s, c) => s + c, 0);
  const categoryLabel = category === 'all' ? 'All Processes' : category;

  return (
    <div className="space-y-0 -mx-4 sm:-mx-6 -my-6">
      {/* Dark container */}
      <div className="bg-[#0d1117] min-h-screen text-slate-300 dark:text-zinc-600">

        {/* Header Bar */}
        <div className="sticky top-[60px] z-30 bg-[#161b22] border-b border-[#30363d] px-5 py-3.5">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <Terminal size={18} className="text-slate-400 dark:text-zinc-500" />
              <h1 className="text-[15px] font-bold text-slate-200 dark:text-zinc-700">Process Logs</h1>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                live ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-500 dark:text-zinc-500'
              }`}>
                {live ? <Wifi size={11} /> : <WifiOff size={11} />}
                {live ? 'Live' : 'Paused'}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setLive(!live)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  live ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-[#21262d] text-slate-400 dark:text-zinc-500 hover:text-slate-300 dark:hover:text-zinc-600 hover:bg-[#30363d]'
                }`}
                title={live ? 'Pause' : 'Start live'}
              >
                {live ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <button
                onClick={() => { setLoading(true); loadLogs(); }}
                className="w-8 h-8 rounded-lg bg-[#21262d] text-slate-400 dark:text-zinc-500 hover:text-slate-300 dark:hover:text-zinc-600 hover:bg-[#30363d] flex items-center justify-center transition-colors"
                title="Refresh"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={downloadLogs}
                className="w-8 h-8 rounded-lg bg-[#21262d] text-slate-400 dark:text-zinc-500 hover:text-slate-300 dark:hover:text-zinc-600 hover:bg-[#30363d] flex items-center justify-center transition-colors"
                title="Download logs"
              >
                <Download size={14} />
              </button>
              <button
                onClick={() => { setLogs([]); setTotal(0); }}
                className="w-8 h-8 rounded-lg bg-[#21262d] text-slate-400 dark:text-zinc-500 hover:text-red-400 hover:bg-[#30363d] flex items-center justify-center transition-colors"
                title="Clear view"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-[#161b22] border-b border-[#30363d] px-5 py-2.5">
          <div className="flex items-center gap-2.5 max-w-7xl mx-auto overflow-x-auto">
            {/* Category dropdown */}
            <div className="relative" ref={categoryRef}>
              <button
                onClick={() => { setCategoryOpen(!categoryOpen); setLevelOpen(false); setTimeOpen(false); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#21262d] border border-[#30363d] rounded-lg text-xs font-medium text-slate-300 dark:text-zinc-600 hover:border-[#484f58] transition-colors min-w-[140px]"
              >
                <Filter size={12} />
                <span className="truncate">{categoryLabel}</span>
                <ChevronDown size={12} className="text-slate-500 dark:text-zinc-500 ml-auto" />
              </button>
              {categoryOpen && (
                <div className="absolute top-full left-0 mt-1 w-52 bg-[#1c2128] border border-[#30363d] rounded-lg shadow-2xl z-50 overflow-hidden">
                  <button
                    onClick={() => { setCategory('all'); setCategoryOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                      category === 'all' ? 'bg-blue-500/15 text-blue-400' : 'text-slate-300 dark:text-zinc-600 hover:bg-[#21262d]'
                    }`}
                  >
                    All Processes
                  </button>
                  {Object.entries(CATEGORY_GROUPS).map(([group, cats]) => (
                    <div key={group}>
                      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider bg-[#161b22]">
                        {group}
                      </div>
                      {cats.map(c => (
                        <button
                          key={c}
                          onClick={() => { setCategory(c); setCategoryOpen(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${
                            category === c ? 'bg-blue-500/15 text-blue-400' : 'text-slate-400 dark:text-zinc-500 hover:bg-[#21262d] hover:text-slate-300 dark:hover:text-zinc-600'
                          }`}
                        >
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[c] || '#64748b' }} />
                          {c}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Client dropdown */}
            <div className="relative" ref={clientRef}>
              <button
                onClick={() => { setClientOpen(!clientOpen); setCategoryOpen(false); setLevelOpen(false); setTimeOpen(false); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#21262d] border border-[#30363d] rounded-lg text-xs font-medium text-slate-300 dark:text-zinc-600 hover:border-[#484f58] transition-colors min-w-[140px]"
              >
                {firmId === 'all' ? (
                  <span className="w-2 h-2 rounded-full bg-slate-500 flex-shrink-0" />
                ) : (
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: firms.find(f => f.id === firmId)?.brand_color || '#6b7280' }} />
                )}
                <span className="truncate">{firmId === 'all' ? 'All Clients' : (firms.find(f => f.id === firmId)?.name || 'Client')}</span>
                <ChevronDown size={12} className="text-slate-500 dark:text-zinc-500 ml-auto" />
              </button>
              {clientOpen && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-[#1c2128] border border-[#30363d] rounded-lg shadow-2xl z-50 overflow-hidden max-h-64 overflow-y-auto">
                  <button
                    onClick={() => { setFirmId('all'); setClientOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                      firmId === 'all' ? 'bg-blue-500/15 text-blue-400' : 'text-slate-300 dark:text-zinc-600 hover:bg-[#21262d]'
                    }`}
                  >
                    All Clients
                  </button>
                  {firms.map(f => (
                    <button
                      key={f.id}
                      onClick={() => { setFirmId(f.id); setClientOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${
                        firmId === f.id ? 'bg-blue-500/15 text-blue-400' : 'text-slate-400 dark:text-zinc-500 hover:bg-[#21262d] hover:text-slate-300 dark:hover:text-zinc-600'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: f.brand_color || '#6b7280' }} />
                      <span className="truncate">{f.name}</span>
                      <span className="text-[10px] text-slate-600 dark:text-zinc-500 ml-auto capitalize">{f.industry}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Level dropdown */}
            <div className="relative" ref={levelRef}>
              <button
                onClick={() => { setLevelOpen(!levelOpen); setCategoryOpen(false); setTimeOpen(false); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#21262d] border border-[#30363d] rounded-lg text-xs font-medium text-slate-300 dark:text-zinc-600 hover:border-[#484f58] transition-colors min-w-[100px]"
              >
                <span className="capitalize">{level === 'all' ? 'All Levels' : level}</span>
                <ChevronDown size={12} className="text-slate-500 dark:text-zinc-500 ml-auto" />
              </button>
              {levelOpen && (
                <div className="absolute top-full left-0 mt-1 w-36 bg-[#1c2128] border border-[#30363d] rounded-lg shadow-2xl z-50 overflow-hidden">
                  {LEVELS.map(l => (
                    <button
                      key={l}
                      onClick={() => { setLevel(l); setLevelOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs font-medium capitalize transition-colors ${
                        level === l ? 'bg-blue-500/15 text-blue-400' : 'text-slate-400 dark:text-zinc-500 hover:bg-[#21262d] hover:text-slate-300 dark:hover:text-zinc-600'
                      }`}
                    >
                      {l === 'all' ? 'All Levels' : l}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Time range */}
            <div className="relative" ref={timeRef}>
              <button
                onClick={() => { setTimeOpen(!timeOpen); setCategoryOpen(false); setLevelOpen(false); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#21262d] border border-[#30363d] rounded-lg text-xs font-medium text-slate-300 dark:text-zinc-600 hover:border-[#484f58] transition-colors"
              >
                <Clock size={12} />
                {TIME_RANGES.find(t => t.key === timeRange)?.label || '24h'}
                <ChevronDown size={12} className="text-slate-500 dark:text-zinc-500" />
              </button>
              {timeOpen && (
                <div className="absolute top-full left-0 mt-1 w-28 bg-[#1c2128] border border-[#30363d] rounded-lg shadow-2xl z-50 overflow-hidden">
                  {TIME_RANGES.map(t => (
                    <button
                      key={t.key}
                      onClick={() => { setTimeRange(t.key); setTimeOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                        timeRange === t.key ? 'bg-blue-500/15 text-blue-400' : 'text-slate-400 dark:text-zinc-500 hover:bg-[#21262d] hover:text-slate-300 dark:hover:text-zinc-600'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-zinc-500" />
              <input
                type="text"
                placeholder="Search logs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#0d1117] border border-[#30363d] rounded-lg text-slate-300 dark:text-zinc-600 placeholder:text-slate-600 dark:placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 font-mono transition-colors"
              />
            </div>

            {/* Log count */}
            <span className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono flex-shrink-0">
              {total} logs
            </span>
          </div>
        </div>

        {/* Error Summary Bar */}
        {totalErrors > 0 && (
          <div className="bg-red-500/5 border-b border-red-500/10 px-5 py-2">
            <div className="flex items-center gap-3 max-w-7xl mx-auto">
              <span className="text-[11px] font-medium text-red-400">{totalErrors} errors (24h):</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {Object.entries(errorCounts).filter(([, c]) => c > 0).map(([cat, count]) => (
                  <button
                    key={cat}
                    onClick={() => { setLevel('error'); setCategory(cat); }}
                    className="px-2 py-0.5 bg-red-500/10 rounded text-[10px] font-mono text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    {cat}:{count}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Log Entries */}
        <div className="max-w-7xl mx-auto" ref={logContainerRef}>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center gap-3 text-slate-500 dark:text-zinc-500">
                <RefreshCw size={16} className="animate-spin" />
                <span className="text-xs font-mono">Loading logs...</span>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 dark:text-zinc-500">
              <Terminal size={28} className="mb-3 opacity-30" />
              <p className="text-sm font-mono">No logs found</p>
              <p className="text-xs text-slate-600 dark:text-zinc-500 mt-1">Adjust your filters or wait for new events</p>
            </div>
          ) : (
            <div className="font-mono text-[13px] leading-relaxed">
              {logs.map((log, idx) => {
                const lc = LEVEL_COLORS[log.level] || LEVEL_COLORS.info;
                const Icon = LEVEL_ICONS[log.level] || Info;
                const isExpanded = expanded === log.id;
                const catColor = CATEGORY_COLORS[log.category] || '#64748b';
                const time = new Date(log.created_at);
                const timeStr = time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const hasDetails = log.details && Object.keys(log.details).length > 0;

                return (
                  <div key={log.id}>
                    <div
                      className={`flex items-start gap-0 px-5 py-[7px] border-b border-[#1c2128] transition-colors cursor-pointer group ${
                        isExpanded ? 'bg-[#161b22]' : 'hover:bg-[#161b22]/60'
                      } ${log.level === 'error' ? 'bg-red-500/[0.03]' : ''}`}
                      onClick={() => hasDetails && setExpanded(isExpanded ? null : log.id)}
                    >
                      {/* Timestamp */}
                      <span className="text-slate-600 dark:text-zinc-500 w-[72px] flex-shrink-0 select-none text-[12px]">
                        {timeStr}
                      </span>

                      {/* Level icon + badge */}
                      <span className={`inline-flex items-center gap-1 w-[56px] flex-shrink-0 ${lc.text}`}>
                        <Icon size={11} />
                        <span className="text-[11px] font-semibold uppercase">{log.level}</span>
                      </span>

                      {/* Category badge */}
                      <span
                        className="inline-block px-2 py-[1px] rounded text-[11px] font-semibold mr-3 flex-shrink-0"
                        style={{
                          backgroundColor: catColor + '20',
                          color: catColor,
                        }}
                      >
                        {log.category}
                      </span>

                      {/* Client name (when viewing all) */}
                      {firmId === 'all' && log.firm_id && (() => {
                        const f = firms.find(fi => fi.id === log.firm_id);
                        return f ? (
                          <span
                            className="inline-block px-1.5 py-[1px] rounded text-[10px] font-semibold mr-2 flex-shrink-0 cursor-pointer"
                            style={{ backgroundColor: (f.brand_color || '#6b7280') + '20', color: f.brand_color || '#6b7280' }}
                            onClick={(e) => { e.stopPropagation(); setFirmId(f.id); }}
                            title={`Filter by ${f.name}`}
                          >
                            {f.name}
                          </span>
                        ) : null;
                      })()}

                      {/* Message */}
                      <span className="text-slate-300 dark:text-zinc-600 flex-1 min-w-0 break-words">
                        {log.message}
                      </span>

                      {/* Duration */}
                      {log.duration_ms && (
                        <span className="text-slate-600 dark:text-zinc-500 text-[11px] ml-3 flex-shrink-0">
                          {log.duration_ms}ms
                        </span>
                      )}

                      {/* Expand indicator */}
                      {hasDetails && (
                        <span className="text-slate-600 dark:text-zinc-500 ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </span>
                      )}
                    </div>

                    {/* Expanded details */}
                    {isExpanded && hasDetails && (
                      <div className="bg-[#0d1117] border-b border-[#1c2128] px-5 py-3 ml-[128px]">
                        <pre className="text-[12px] text-slate-400 dark:text-zinc-500 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                        {log.call_id && (
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-600 dark:text-zinc-500">
                            <span>Call ID:</span>
                            <code className="bg-[#161b22] px-2 py-0.5 rounded text-slate-400 dark:text-zinc-500">{log.call_id}</code>
                          </div>
                        )}
                        {log.source && (
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-600 dark:text-zinc-500">
                            <span>Source:</span>
                            <code className="bg-[#161b22] px-2 py-0.5 rounded text-slate-400 dark:text-zinc-500">{log.source}</code>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

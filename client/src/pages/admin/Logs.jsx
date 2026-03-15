import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchLogs } from '../../services/api';
import { AlertTriangle, Info, AlertCircle, Bug, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

const LEVELS = ['all', 'error', 'warn', 'info', 'debug'];
const CATEGORIES = ['all', 'retell_webhook', 'retell_api', 'tool_call', 'lead_scoring', 'calendar', 'sms', 'email', 'crm_push', 'auth', 'admin', 'staff', 'system', 'database', 'appointment', 'intake', 'lead', 'prompt'];

const levelConfig = {
  error: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
  warn: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
  info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50' },
  debug: { icon: Bug, color: 'text-slate-400', bg: 'bg-slate-50' },
};

export default function Logs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [errorCounts, setErrorCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [level, setLevel] = useState(searchParams.get('level') || 'all');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [search, setSearch] = useState(searchParams.get('search') || '');

  const loadLogs = useCallback(async () => {
    try {
      const params = { limit: 50 };
      if (level !== 'all') params.level = level;
      if (category !== 'all') params.category = category;
      if (search) params.search = search;

      const data = await fetchLogs(params);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setErrorCounts(data.error_counts || {});
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  }, [level, category, search]);

  useEffect(() => {
    setLoading(true);
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadLogs]);

  const totalErrors = Object.values(errorCounts).reduce((s, c) => s + c, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">System Logs</h2>
          <p className="text-sm text-slate-400 mt-1">{total} total entries · {totalErrors} errors (24h)</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-500">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="rounded border-slate-300" />
            Auto-refresh
          </label>
          <button onClick={() => { setLoading(true); loadLogs(); }}
            className="p-2 rounded-xl hover:bg-slate-50 transition-colors text-slate-400 hover:text-slate-600">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-slate-50 rounded-xl p-1">
          {LEVELS.map(l => (
            <button key={l} onClick={() => setLevel(l)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                level === l ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}>{l}</button>
          ))}
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="px-3 py-2 text-xs bg-white border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200">
          {CATEGORIES.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
        </select>
        <input type="text" placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-48 px-3 py-2 text-xs bg-white border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300" />
      </div>

      {/* Error Summary */}
      {totalErrors > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(errorCounts).map(([cat, count]) => (
            <button key={cat} onClick={() => { setLevel('error'); setCategory(cat); }}
              className="px-3 py-1.5 bg-red-50 rounded-lg text-xs font-medium text-red-700 hover:bg-red-100 transition-colors">
              {cat}: {count}
            </button>
          ))}
        </div>
      )}

      {/* Log Entries */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
          <Info size={24} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No logs found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="divide-y divide-slate-50">
            {logs.map((log) => {
              const config = levelConfig[log.level] || levelConfig.info;
              const Icon = config.icon;
              const isExpanded = expanded === log.id;

              return (
                <div key={log.id}>
                  <div className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : log.id)}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${config.bg}`}>
                      <Icon size={13} className={config.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold uppercase ${config.color}`}>{log.level}</span>
                        <span className="text-[10px] text-slate-300">·</span>
                        <span className="text-[10px] text-slate-400">{log.category}</span>
                        {log.source && (
                          <>
                            <span className="text-[10px] text-slate-300">·</span>
                            <span className="text-[10px] text-slate-300">{log.source}</span>
                          </>
                        )}
                      </div>
                      <p className="text-sm text-slate-700 mt-0.5">{log.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {new Date(log.created_at).toLocaleString()}
                        {log.duration_ms && <span className="ml-2">· {log.duration_ms}ms</span>}
                        {log.call_id && <span className="ml-2">· call: {log.call_id.slice(0, 12)}...</span>}
                      </p>
                    </div>
                    {log.details && Object.keys(log.details).length > 0 && (
                      isExpanded ? <ChevronUp size={14} className="text-slate-300 mt-1" /> : <ChevronDown size={14} className="text-slate-300 mt-1" />
                    )}
                  </div>
                  {isExpanded && log.details && Object.keys(log.details).length > 0 && (
                    <div className="px-5 pb-3 ml-10">
                      <pre className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3 overflow-x-auto max-h-48">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

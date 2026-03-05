import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, BellOff, Filter, CheckCircle, AlertTriangle,
  XCircle, Info, ChevronDown, RefreshCw,
} from 'lucide-react';
import { PageHeader } from '../App';
import { alertsAPI } from '../services/api';
import {
  formatDate, formatRelativeDate, getSeverityBgColor,
  getSeverityColor,
} from '../utils/helpers';

const SEVERITY_FILTERS = [
  { value: '', label: 'All', icon: null },
  { value: 'critical', label: 'Critical', icon: XCircle },
  { value: 'warning', label: 'Warning', icon: AlertTriangle },
  { value: 'info', label: 'Info', icon: Info },
];

function AlertIcon({ severity }) {
  switch (severity) {
    case 'critical':
      return <XCircle className="w-5 h-5 text-red-400" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-amber-400" />;
    default:
      return <Info className="w-5 h-5 text-blue-400" />;
  }
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('');
  const [acknowledging, setAcknowledging] = useState(null);

  async function loadAlerts() {
    setLoading(true);
    try {
      const [alertsRes, statsRes] = await Promise.all([
        alertsAPI.list(severityFilter || undefined, 0, 100),
        alertsAPI.getStats(),
      ]);
      setAlerts(alertsRes.data || []);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts();
  }, [severityFilter]);

  async function handleAcknowledge(alertId) {
    setAcknowledging(alertId);
    try {
      await alertsAPI.acknowledge(alertId);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
      );
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    } finally {
      setAcknowledging(null);
    }
  }

  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <>
      <PageHeader
        title="Alerts"
        subtitle={stats ? `${stats.total_unacknowledged || 0} unacknowledged alerts` : 'Loading...'}
      >
        <button onClick={loadAlerts} className="btn-secondary" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </PageHeader>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {['critical', 'warning', 'info'].map((sev) => (
            <div key={sev} className="stat-card">
              <div className="flex items-center gap-2 mb-1">
                <AlertIcon severity={sev} />
                <span className="text-xs text-gray-400 capitalize">{sev}</span>
              </div>
              <p className="text-xl font-bold text-white">
                {stats.by_severity?.[sev] || 0}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">Last 7 days</p>
            </div>
          ))}
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-1">
              <BellOff className="w-5 h-5 text-gray-400" />
              <span className="text-xs text-gray-400">Unacknowledged</span>
            </div>
            <p className="text-xl font-bold text-white">
              {stats.total_unacknowledged || 0}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">Pending review</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <Filter className="w-4 h-4 text-gray-500" />
        <div className="flex rounded-lg overflow-hidden border border-navy-600">
          {SEVERITY_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setSeverityFilter(value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                severityFilter === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-navy-800 text-gray-400 hover:text-gray-200 hover:bg-navy-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Alert List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="card p-12 text-center">
          <Bell className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No alerts found</p>
          <p className="text-sm text-gray-600 mt-1">Try changing the filter or check back later</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`card p-4 flex items-start gap-4 transition-all ${
                !alert.acknowledged ? 'border-l-2 border-l-blue-500' : 'opacity-75'
              }`}
            >
              <AlertIcon severity={alert.severity} />

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-200 font-medium">{alert.message}</p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getSeverityBgColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      <span className="text-xs text-gray-500">{alert.alert_type}</span>
                      <span className="text-xs text-gray-500">•</span>
                      <Link
                        to={`/meters/${alert.meter_id}`}
                        className="text-xs text-blue-400 hover:text-blue-300 font-mono"
                      >
                        {alert.meter_id}
                      </Link>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-500" title={formatDate(alert.created_at)}>
                        {formatRelativeDate(alert.created_at)}
                      </span>
                    </div>
                  </div>

                  {!alert.acknowledged && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      disabled={acknowledging === alert.id}
                      className="btn-secondary text-xs shrink-0"
                    >
                      {acknowledging === alert.id ? (
                        <div className="w-3.5 h-3.5 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CheckCircle className="w-3.5 h-3.5" />
                      )}
                      Acknowledge
                    </button>
                  )}
                  {alert.acknowledged && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 shrink-0">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Acknowledged
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

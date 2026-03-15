import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellOff, Filter, CheckCircle, AlertTriangle,
  XCircle, Info, RefreshCw, Sparkles, ClipboardList,
  ChevronDown, ChevronUp, Zap, MapPin,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { alertsAPI, aiAPI, metersAPI } from '../services/api';
import {
  formatDate, formatRelativeDate, getSeverityBgColor,
} from '../utils/helpers';

const SEVERITY_FILTERS = [
  { value: '', label: 'All', icon: null },
  { value: 'critical', label: 'Critical', icon: XCircle },
  { value: 'warning', label: 'Warning', icon: AlertTriangle },
  { value: 'info', label: 'Info', icon: Info },
];

const ALERT_TYPE_LABELS = {
  anomaly: 'Predictive anomaly',
  threshold: 'Operational limit',
  comm_loss: 'Communication loss',
  maintenance: 'Maintenance reminder',
};

function formatAlertType(alertType) {
  if (!alertType) return 'Alert';
  return ALERT_TYPE_LABELS[alertType] || alertType.replace(/_/g, ' ');
}

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

function AlertDetailPanel({ alert, onClose }) {
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [generatingWO, setGeneratingWO] = useState(false);
  const [woResult, setWoResult] = useState(null);

  async function handleSummarize() {
    setLoadingSummary(true);
    try {
      const res = await aiAPI.summarize(alert.meter_id, alert.id);
      setSummary(res.data);
    } catch (err) {
      setSummary({ summary: 'Unable to generate AI summary at this time.', recommendations: [] });
    } finally {
      setLoadingSummary(false);
    }
  }

  async function handleGenerateWorkOrder() {
    setGeneratingWO(true);
    try {
      const res = await aiAPI.generateWorkOrder(alert.id);
      setWoResult(res.data);
    } catch (err) {
      setWoResult({ error: 'Failed to generate work order' });
    } finally {
      setGeneratingWO(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="mt-3 pt-3 border-t border-navy-700/30">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          {/* AI Summary */}
          <div className="p-3 rounded-xl bg-navy-900/60 border border-navy-700/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs font-medium text-purple-400">AI Analysis</span>
              </div>
              {!summary && (
                <button
                  onClick={handleSummarize}
                  disabled={loadingSummary}
                  className="text-[10px] px-2 py-1 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/20 hover:bg-purple-500/25 transition-colors"
                >
                  {loadingSummary ? 'Analyzing...' : 'Generate Summary'}
                </button>
              )}
            </div>
            {summary ? (
              <div>
                <p className="text-xs text-gray-300 leading-relaxed">{summary.summary}</p>
                {summary.recommendations?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] text-gray-500 mb-1">Recommendations:</p>
                    <ul className="space-y-1">
                      {summary.recommendations.map((r, i) => (
                        <li key={i} className="text-[10px] text-gray-400 flex items-start gap-1.5">
                          <span className="text-purple-400 mt-0.5">•</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : !loadingSummary ? (
              <p className="text-[10px] text-gray-500">Click to get LLM-powered anomaly analysis</p>
            ) : (
              <div className="flex items-center gap-2 py-2">
                <div className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] text-gray-400">GPT-4o analyzing anomaly...</span>
              </div>
            )}
          </div>

          {/* Generate Work Order */}
          <div className="p-3 rounded-xl bg-navy-900/60 border border-navy-700/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-medium text-amber-400">Work Order</span>
              </div>
              {!woResult && (
                <button
                  onClick={handleGenerateWorkOrder}
                  disabled={generatingWO}
                  className="text-[10px] px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25 transition-colors"
                >
                  {generatingWO ? 'Generating...' : 'Auto-Generate'}
                </button>
              )}
            </div>
            {woResult ? (
              woResult.error ? (
                <p className="text-xs text-red-400">{woResult.error}</p>
              ) : (
                <div className="text-xs">
                  <p className="text-gray-300 font-medium">{woResult.title || 'Work order created'}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{woResult.description?.slice(0, 120)}</p>
                  {woResult.work_order_id && (
                    <Link to="/workorders" className="text-[10px] text-blue-400 hover:text-blue-300 mt-2 inline-block">
                      View in Work Orders →
                    </Link>
                  )}
                </div>
              )
            ) : !generatingWO ? (
              <p className="text-[10px] text-gray-500">AI-generated maintenance work order</p>
            ) : (
              <div className="flex items-center gap-2 py-2">
                <div className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] text-gray-400">Creating work order...</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Link to={`/meters/${alert.meter_id}`} className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors">
            <MapPin className="w-3 h-3 inline mr-1" />View Meter
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export default function Alerts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState(searchParams.get('severity') || '');
  const [acknowledging, setAcknowledging] = useState(null);
  const [expandedAlertId, setExpandedAlertId] = useState(null);

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

  function handleSeverityFilter(nextFilter) {
    setSeverityFilter(nextFilter);
    if (nextFilter) {
      setSearchParams({ severity: nextFilter });
    } else {
      setSearchParams({});
    }
  }

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
              <p className="text-xl font-bold text-white">{stats.by_severity?.[sev] || 0}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Last 7 days</p>
            </div>
          ))}
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-1">
              <BellOff className="w-5 h-5 text-gray-400" />
              <span className="text-xs text-gray-400">Unacknowledged</span>
            </div>
            <p className="text-xl font-bold text-white">{stats.total_unacknowledged || 0}</p>
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
              onClick={() => handleSeverityFilter(value)}
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
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const isExpanded = expandedAlertId === alert.id;
            return (
              <div
                key={alert.id}
                className={`card p-4 transition-all ${
                  !alert.acknowledged ? 'border-l-2 border-l-blue-500' : 'opacity-75'
                }`}
              >
                <div className="flex items-start gap-4">
                  <AlertIcon severity={alert.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-gray-200 font-medium">{alert.message}</p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getSeverityBgColor(alert.severity)}`}>
                            {alert.severity}
                          </span>
                          <span className="text-xs text-gray-500 capitalize">{formatAlertType(alert.alert_type)}</span>
                          <span className="text-xs text-gray-500">•</span>
                          <Link to={`/meters/${alert.meter_id}`} className="text-xs text-blue-400 hover:text-blue-300 font-mono">
                            {alert.meter_id}
                          </Link>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-500" title={formatDate(alert.created_at)}>
                            {formatRelativeDate(alert.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setExpandedAlertId(isExpanded ? null : alert.id)}
                          className="p-1.5 rounded-lg hover:bg-navy-700/50 transition-colors text-gray-500 hover:text-gray-300"
                          title="Expand details"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {!alert.acknowledged && (
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            disabled={acknowledging === alert.id}
                            className="btn-secondary text-xs"
                          >
                            {acknowledging === alert.id ? (
                              <div className="w-3.5 h-3.5 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            Ack
                          </button>
                        )}
                        {alert.acknowledged && (
                          <span className="flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && <AlertDetailPanel alert={alert} />}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

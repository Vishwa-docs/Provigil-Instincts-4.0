import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter,
} from 'recharts';
import {
  ArrowLeft, Activity, Thermometer, Zap, Gauge, Clock,
  MapPin, AlertTriangle, CheckCircle, XCircle, TrendingDown,
} from 'lucide-react';
import { metersAPI } from '../services/api';
import {
  formatDate, getStatusBgColor, getHealthScoreLabel, getHealthScoreColor,
  getSeverityBgColor, formatRelativeDate,
} from '../utils/helpers';

function MetricCard({ icon: Icon, label, value, unit, color }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-navy-900/40 border border-navy-700/30">
      <div className={`p-2 rounded-lg ${color || 'bg-blue-500/10'}`}>
        <Icon className="w-4 h-4 text-blue-400" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-semibold text-white">
          {value !== null && value !== undefined ? value : '—'}
          {unit && <span className="text-xs text-gray-400 ml-1">{unit}</span>}
        </p>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
        </p>
      ))}
    </div>
  );
}

export default function MeterDetail() {
  const { id } = useParams();
  const [meter, setMeter] = useState(null);
  const [readings, setReadings] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [healthHistory, setHealthHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState('voltage');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [meterRes, readingsRes, anomaliesRes, healthRes] = await Promise.all([
          metersAPI.get(id),
          metersAPI.getReadings(id),
          metersAPI.getAnomalies(id),
          metersAPI.getHealth(id),
        ]);
        setMeter(meterRes.data);

        const readingData = (readingsRes.data || []).reverse().map((r) => ({
          ...r,
          time: formatDate(r.timestamp, 'HH:mm'),
          dateLabel: formatDate(r.timestamp, 'MMM d HH:mm'),
        }));
        setReadings(readingData);
        setAnomalies(anomaliesRes.data || []);
        setHealthHistory(
          (healthRes.data.history || []).map((h) => ({
            ...h,
            time: formatDate(h.timestamp, 'MMM d'),
            score: Math.round(h.score * 100),
          }))
        );
      } catch (err) {
        console.error('Failed to load meter details:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!meter) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Meter not found</p>
        <Link to="/meters" className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block">
          ← Back to fleet
        </Link>
      </div>
    );
  }

  const healthPct = Math.round(meter.health_score * 100);
  const latestReading = readings.length > 0 ? readings[readings.length - 1] : null;

  const chartOptions = [
    { key: 'voltage', label: 'Voltage', color: '#3b82f6' },
    { key: 'current', label: 'Current', color: '#8b5cf6' },
    { key: 'power', label: 'Power', color: '#10b981' },
    { key: 'temperature', label: 'Temperature', color: '#f59e0b' },
    { key: 'power_factor', label: 'Power Factor', color: '#06b6d4' },
    { key: 'frequency', label: 'Frequency', color: '#ec4899' },
  ];

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link to="/meters" className="hover:text-gray-200 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          Meter Fleet
        </Link>
        <span>/</span>
        <span className="text-gray-200">{meter.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{meter.name}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBgColor(meter.status)}`}>
              {meter.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 font-mono mt-1">{meter.id}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
            {meter.install_date && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Installed {formatDate(meter.install_date, 'MMM d, yyyy')}
              </span>
            )}
            {meter.location_lat && meter.location_lng && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {meter.location_lat.toFixed(4)}, {meter.location_lng.toFixed(4)}
              </span>
            )}
            {meter.last_seen && (
              <span className="flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" />
                Last seen {formatRelativeDate(meter.last_seen)}
              </span>
            )}
          </div>
        </div>

        {/* Health Score */}
        <div className="card p-4 min-w-[200px]">
          <p className="text-xs text-gray-400 mb-2">Health Score</p>
          <div className="flex items-end gap-2">
            <span className={`text-3xl font-bold ${getHealthScoreColor(healthPct)}`}>
              {healthPct}%
            </span>
            <span className={`text-sm mb-1 ${getHealthScoreColor(healthPct)}`}>
              {getHealthScoreLabel(healthPct)}
            </span>
          </div>
          <div className="mt-2 h-2 bg-navy-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                healthPct >= 85 ? 'bg-emerald-500' :
                healthPct >= 70 ? 'bg-blue-500' :
                healthPct >= 50 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${healthPct}%` }}
            />
          </div>
          {meter.suspected_issue && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              {meter.suspected_issue}
            </div>
          )}
        </div>
      </div>

      {/* Latest Metrics */}
      {latestReading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <MetricCard icon={Zap} label="Voltage" value={latestReading.voltage?.toFixed(1)} unit="V" />
          <MetricCard icon={Activity} label="Current" value={latestReading.current?.toFixed(2)} unit="A" />
          <MetricCard icon={Gauge} label="Power" value={latestReading.power?.toFixed(1)} unit="W" />
          <MetricCard icon={Thermometer} label="Temperature" value={latestReading.temperature?.toFixed(1)} unit="°C" />
          <MetricCard icon={TrendingDown} label="Power Factor" value={latestReading.power_factor?.toFixed(3)} unit="" />
          <MetricCard icon={Activity} label="Frequency" value={latestReading.frequency?.toFixed(2)} unit="Hz" />
        </div>
      )}

      {/* Telemetry Chart */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-200">Telemetry Data</h3>
          <div className="flex gap-1 flex-wrap">
            {chartOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setActiveChart(opt.key)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  activeChart === opt.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-navy-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={readings}>
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartOptions.find(c => c.key === activeChart)?.color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={chartOptions.find(c => c.key === activeChart)?.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#28355d" strokeOpacity={0.5} />
              <XAxis
                dataKey="time"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#28355d' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey={activeChart}
                name={chartOptions.find(c => c.key === activeChart)?.label}
                stroke={chartOptions.find(c => c.key === activeChart)?.color}
                fill="url(#chartGrad)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Health History */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Health Score History</h3>
          <div className="h-56">
            {healthHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={healthHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#28355d" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={{ stroke: '#28355d' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    name="Health %"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={{ fill: '#06b6d4', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                No health history available
              </div>
            )}
          </div>
        </div>

        {/* Anomalies */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">
            Anomaly History
            {anomalies.length > 0 && (
              <span className="ml-2 text-xs text-gray-500">({anomalies.length} records)</span>
            )}
          </h3>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {anomalies.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No anomalies detected</p>
            ) : (
              anomalies.map((anomaly) => (
                <div
                  key={anomaly.id}
                  className="p-3 rounded-lg bg-navy-900/40 border border-navy-700/30"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${getSeverityBgColor(anomaly.risk_level)}`}>
                        {anomaly.risk_level}
                      </span>
                      {anomaly.suspected_issue && (
                        <span className="text-xs text-gray-300">{anomaly.suspected_issue}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {anomaly.resolved ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-500">
                    <span>Score: {(anomaly.anomaly_score * 100).toFixed(1)}%</span>
                    <span>{formatDate(anomaly.detected_at)}</span>
                  </div>
                  {anomaly.contributing_factors && Array.isArray(anomaly.contributing_factors) && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {anomaly.contributing_factors.slice(0, 4).map((f, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded bg-navy-700/50 text-[10px] text-gray-400">
                          {typeof f === 'string' ? f : f.feature || f.name || JSON.stringify(f)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

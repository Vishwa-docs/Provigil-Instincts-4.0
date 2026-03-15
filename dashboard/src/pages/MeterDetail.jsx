import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import {
  ArrowLeft, Activity, Thermometer, Zap, Gauge, Clock,
  MapPin, AlertTriangle, CheckCircle, XCircle, TrendingDown,
  TrendingUp, Battery, Wifi, Network, RefreshCw, Box,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { metersAPI, networkAPI, digitalTwinAPI, modelAPI } from '../services/api';
import {
  formatDate, getStatusBgColor, getHealthScoreLabel, getHealthScoreColor,
  getSeverityBgColor, formatRelativeDate,
} from '../utils/helpers';

function MetricCard({ icon: Icon, label, value, unit, color }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-navy-900/40 border border-navy-700/30">
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
    <div className="bg-navy-800/95 backdrop-blur border border-navy-600 rounded-xl px-3 py-2 shadow-xl">
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
  const [forecast, setForecast] = useState(null);
  const [remainingLife, setRemainingLife] = useState(null);
  const [neighbors, setNeighbors] = useState(null);
  const [twinData, setTwinData] = useState(null);
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

        // Non-critical: load in background
        metersAPI.getForecast(id, 7).then(r => setForecast(r.data)).catch(() => {});
        metersAPI.getRemainingLife(id).then(r => setRemainingLife(r.data)).catch(() => {});
        networkAPI.getNeighbors(id).then(r => setNeighbors(r.data)).catch(() => {});
        digitalTwinAPI.get(id).then(r => setTwinData(r.data)).catch(() => {});
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
        <Link to="/meters" className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block">← Back to fleet</Link>
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

  const forecastData = forecast?.forecasts?.map((f) => ({
    day: `Day ${f.day}`,
    health: Math.round(f.predicted_health * 100),
    upper: Math.round(f.upper_bound * 100),
    lower: Math.round(f.lower_bound * 100),
  })) || [];

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link to="/meters" className="hover:text-gray-200 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />Meter Fleet
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
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 flex-wrap">
            {meter.install_date && (
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Installed {formatDate(meter.install_date, 'MMM d, yyyy')}</span>
            )}
            {meter.location_lat && meter.location_lng && (
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{meter.location_lat.toFixed(4)}, {meter.location_lng.toFixed(4)}</span>
            )}
            {meter.last_seen && (
              <span className="flex items-center gap-1"><Activity className="w-3.5 h-3.5" />Last seen {formatRelativeDate(meter.last_seen)}</span>
            )}
          </div>
        </div>

        {/* Health Score */}
        <div className="card p-4 min-w-[200px]">
          <p className="text-xs text-gray-400 mb-2">Health Score</p>
          <div className="flex items-end gap-2">
            <span className={`text-3xl font-bold ${getHealthScoreColor(healthPct)}`}>{healthPct}%</span>
            <span className={`text-sm mb-1 ${getHealthScoreColor(healthPct)}`}>{getHealthScoreLabel(healthPct)}</span>
          </div>
          <div className="mt-2 h-2 bg-navy-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${healthPct >= 85 ? 'bg-emerald-500' : healthPct >= 70 ? 'bg-blue-500' : healthPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${healthPct}%` }}
            />
          </div>
          {meter.suspected_issue && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />{meter.suspected_issue}
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
          <MetricCard icon={TrendingDown} label="Power Factor" value={latestReading.power_factor?.toFixed(3)} />
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
                  activeChart === opt.key ? 'bg-blue-600 text-white' : 'bg-navy-800 text-gray-400 hover:text-gray-200'
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
              <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#28355d' }} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
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

      {/* Forecast + Remaining Life */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Health Forecast */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-gray-200">7-Day Health Forecast</h3>
          </div>
          {forecastData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData}>
                  <defs>
                    <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#28355d" strokeOpacity={0.5} />
                  <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#28355d' }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="upper" name="Upper Bound" stroke="none" fill="#06b6d420" />
                  <Area type="monotone" dataKey="lower" name="Lower Bound" stroke="none" fill="#06b6d410" />
                  <Line type="monotone" dataKey="health" name="Predicted" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4', r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-56 text-gray-500 text-sm">
              Insufficient data for forecasting
            </div>
          )}
          {forecast?.trend && (
            <div className="mt-3 p-2.5 rounded-lg bg-navy-900/50 border border-navy-700/30">
              <p className="text-xs text-gray-400">
                Trend: <span className={forecast.trend === 'declining' ? 'text-red-400' : forecast.trend === 'stable' ? 'text-emerald-400' : 'text-amber-400'}>{forecast.trend}</span>
                {forecast.days_to_critical && <span className="ml-2">| Est. critical in <span className="text-red-400 font-medium">{forecast.days_to_critical} days</span></span>}
              </p>
            </div>
          )}
        </div>

        {/* Remaining Life & Battery */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Battery className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-gray-200">Remaining Life Estimate</h3>
          </div>
          {remainingLife ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-navy-900/50 border border-navy-700/30">
                <p className="text-xs text-gray-500 mb-1">Estimated Remaining Life</p>
                <p className="text-2xl font-bold text-white">{remainingLife.remaining_days || '—'} <span className="text-sm text-gray-400">days</span></p>
                <p className="text-xs text-gray-500 mt-1">{remainingLife.remaining_years?.toFixed(1) || '—'} years</p>
              </div>
              <div className="p-4 rounded-xl bg-navy-900/50 border border-navy-700/30">
                <p className="text-xs text-gray-500 mb-1">Battery Health</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-navy-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${(remainingLife.battery_health || 0) >= 0.7 ? 'bg-emerald-500' : (remainingLife.battery_health || 0) >= 0.4 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.round((remainingLife.battery_health || 0) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-white">{Math.round((remainingLife.battery_health || 0) * 100)}%</span>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-navy-900/50 border border-navy-700/30">
                <p className="text-xs text-gray-500 mb-1">Health Decay Rate</p>
                <p className="text-sm font-medium text-gray-200">{remainingLife.decay_rate_per_day?.toFixed(5) || '—'} <span className="text-xs text-gray-500">per day</span></p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-56 text-gray-500 text-sm">Loading...</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Health History */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Health Score History</h3>
          <div className="h-56">
            {healthHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={healthHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#28355d" strokeOpacity={0.5} />
                  <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#28355d' }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="score" name="Health %" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4', r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">No health history</div>
            )}
          </div>
        </div>

        {/* Network Neighbors */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Network className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-gray-200">Network Neighbors</h3>
          </div>
          {neighbors ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-navy-900/50 border border-navy-700/30">
                <p className="text-xs text-gray-500 mb-1">Analysis</p>
                <p className={`text-sm font-medium ${neighbors.analysis === 'local_issue' ? 'text-amber-400' : neighbors.analysis === 'grid_wide_issue' ? 'text-red-400' : 'text-emerald-400'}`}>
                  {neighbors.analysis === 'local_issue' ? 'Localized Issue' : neighbors.analysis === 'grid_wide_issue' ? 'Grid-Wide Issue' : 'Normal'}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">{neighbors.explanation}</p>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {neighbors.neighbors?.map((n) => (
                  <Link
                    key={n.meter_id}
                    to={`/meters/${n.meter_id}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-navy-900/30 hover:bg-navy-800/50 transition-colors"
                  >
                    <span className="text-xs text-gray-300">{n.meter_id}</span>
                    <span className={`text-xs font-medium ${n.health >= 0.7 ? 'text-emerald-400' : n.health >= 0.4 ? 'text-amber-400' : 'text-red-400'}`}>
                      {Math.round(n.health * 100)}%
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-500 text-sm">Loading...</div>
          )}
        </div>

        {/* Component Health (mini digital twin) */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-gray-200">Component Health</h3>
            </div>
            <Link to={`/digital-twin?meter=${meter.id}`} className="text-[10px] text-blue-400 hover:text-blue-300">3D View →</Link>
          </div>
          {twinData?.components ? (
            <div className="space-y-2.5">
              {Object.entries(twinData.components).map(([key, health]) => {
                const pct = Math.round(health * 100);
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 capitalize w-24 truncate">{key.replace('_', ' ')}</span>
                    <div className="flex-1 h-1.5 bg-navy-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 85 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 35 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium tabular-nums ${pct >= 85 ? 'text-emerald-400' : pct >= 60 ? 'text-blue-400' : pct >= 35 ? 'text-amber-400' : 'text-red-400'}`}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-500 text-sm">Loading...</div>
          )}
        </div>
      </div>

      {/* Anomalies */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-200 mb-4">
          Anomaly History
          {anomalies.length > 0 && <span className="ml-2 text-xs text-gray-500">({anomalies.length} records)</span>}
        </h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {anomalies.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No anomalies detected</p>
          ) : (
            anomalies.map((anomaly) => (
              <div key={anomaly.id} className="p-3 rounded-xl bg-navy-900/40 border border-navy-700/30">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${getSeverityBgColor(anomaly.risk_level)}`}>
                      {anomaly.risk_level}
                    </span>
                    {anomaly.suspected_issue && <span className="text-xs text-gray-300">{anomaly.suspected_issue}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    {anomaly.resolved ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
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
    </>
  );
}

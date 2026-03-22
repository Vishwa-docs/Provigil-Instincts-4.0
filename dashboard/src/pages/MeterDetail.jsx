import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
 LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
 ResponsiveContainer, AreaChart, Area, ReferenceLine,
} from 'recharts';
import {
 ArrowLeft, Activity, Thermometer, Zap, Gauge, Clock,
 MapPin, AlertTriangle, CheckCircle, XCircle, TrendingDown,
 TrendingUp, Battery, Wifi, Network, RefreshCw, Box, Cpu,
 Radio,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { metersAPI, networkAPI, digitalTwinAPI, modelAPI } from '../services/api';
import {
 formatDate, getStatusBgColor, getHealthScoreLabel, getHealthScoreColor,
 getSeverityBgColor, formatRelativeDate, formatIssueLabel,
} from '../utils/helpers';

function MetricCard({ icon: Icon, label, value, unit, color }) {
 return (
 <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
 <div className={`p-2 rounded-lg ${color || 'bg-blue-50'}`}>
 <Icon className="w-4 h-4 text-[#0071E3]"/>
 </div>
 <div>
 <p className="text-xs text-gray-500">{label}</p>
 <p className="text-sm font-semibold text-gray-900">
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
 <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-md">
 <p className="text-xs text-gray-400 mb-1">{label}</p>
 {payload.map((entry, i) => (
 <p key={i} className="text-sm font-medium"style={{ color: entry.color }}>
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
 const [activeChart, setActiveChart] = useState('voltage');  useEffect(() => {
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
 );  // Non-critical: load in background
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
 }, [id]);  if (loading) {
 return (
 <div className="flex items-center justify-center h-[60vh]">
 <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
 </div>
 );
 }  if (!meter) {
 return (
 <div className="text-center py-20">
 <p className="text-gray-400">Meter not found</p>
 <Link to="/meters"className="text-[#0071E3] hover:text-blue-600 text-sm mt-2 inline-block">← Back to fleet</Link>
 </div>
 );
 }  const healthPct = Math.round(meter.health_score * 100);
 const latestReading = readings.length > 0 ? readings[readings.length - 1] : null;  const chartOptions = [
 { key: 'voltage', label: 'Voltage', color: '#3b82f6', unit: 'V' },
 { key: 'current', label: 'Current', color: '#8b5cf6', unit: 'A' },
 { key: 'power', label: 'Power', color: '#10b981', unit: 'W' },
 { key: 'temperature', label: 'Temperature', color: '#f59e0b', unit: '°C' },
 { key: 'power_factor', label: 'Power Factor', color: '#06b6d4' },
 { key: 'frequency', label: 'Frequency', color: '#ec4899', unit: 'Hz' },
 { key: 'thd', label: 'THD', color: '#ef4444', unit: '%' },
 { key: 'relay_chatter_ms', label: 'Relay Chatter', color: '#f97316', unit: 'ms' },
 { key: 'battery_voltage', label: 'Battery', color: '#22c55e', unit: 'V' },
 { key: 'voc_ppm', label: 'VOC Gas', color: '#a855f7', unit: 'ppm' },
 ];  const forecastData = forecast?.forecasts?.map((f) => ({
 day: `Day ${f.day}`,
 health: Math.round(f.predicted_health * 100),
 upper: Math.round(f.upper_bound * 100),
 lower: Math.round(f.lower_bound * 100),
 })) || [];  return (
 <>
 {/* Breadcrumb */}
 <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
 <Link to="/meters"className="hover:text-gray-700 transition-colors flex items-center gap-1">
 <ArrowLeft className="w-4 h-4"/>Meter Fleet
 </Link>
 <span>/</span>
 <span className="text-gray-700">{meter.name}</span>
 </div>  {/* Header */}
 <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
 <div>
 <div className="flex items-center gap-3">
 <h1 className="text-2xl font-bold text-gray-900">{meter.name}</h1>
 <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBgColor(meter.status)}`}>
 {meter.status}
 </span>
 </div>
 <p className="text-sm text-gray-500 font-mono mt-1">{meter.id}</p>
 <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 flex-wrap">
 {meter.install_date && (
 <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5"/>Installed {formatDate(meter.install_date, 'MMM d, yyyy')}</span>
 )}
 {meter.location_lat && meter.location_lng && (
 <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5"/>{meter.location_lat.toFixed(4)}, {meter.location_lng.toFixed(4)}</span>
 )}
 {meter.last_seen && (
 <span className="flex items-center gap-1"><Activity className="w-3.5 h-3.5"/>Last seen {formatRelativeDate(meter.last_seen)}</span>
 )}
 </div>
 </div>  {/* Health Score */}
 <div className="card p-4 min-w-[200px]">
 <p className="text-xs text-gray-400 mb-2">Health Score</p>
 <div className="flex items-end gap-2">
 <span className={`text-3xl font-bold ${getHealthScoreColor(healthPct)}`}>{healthPct}%</span>
 <span className={`text-sm mb-1 ${getHealthScoreColor(healthPct)}`}>{getHealthScoreLabel(healthPct)}</span>
 </div>
 <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
 <div
 className={`h-full rounded-full transition-all duration-500 ${healthPct >= 85 ? 'bg-green-500' : healthPct >= 70 ? 'bg-blue-500' : healthPct >= 50 ? 'bg-orange-500' : 'bg-red-500'}`}
 style={{ width: `${healthPct}%` }}
 />
 </div>
 {meter.suspected_issue && (
 <div className="mt-2 flex items-center gap-1.5 text-xs text-orange-500">
 <AlertTriangle className="w-3.5 h-3.5"/>{formatIssueLabel(meter.suspected_issue)}
 </div>
 )}
 </div>
 </div>  {/* Latest Metrics */}
 {latestReading && (
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
 <MetricCard icon={Zap} label="Voltage"value={latestReading.voltage?.toFixed(1)} unit="V"/>
 <MetricCard icon={Activity} label="Current"value={latestReading.current?.toFixed(2)} unit="A"/>
 <MetricCard icon={Gauge} label="Power"value={latestReading.power?.toFixed(1)} unit="W"/>
 <MetricCard icon={Thermometer} label="Temperature"value={latestReading.temperature?.toFixed(1)} unit="°C"/>
 <MetricCard icon={TrendingDown} label="Power Factor"value={latestReading.power_factor?.toFixed(3)} />
 </div>
 )}

 {/* Extended metrics row */}
 {latestReading && (
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
 <MetricCard icon={Activity} label="Frequency"value={latestReading.frequency?.toFixed(2)} unit="Hz"/>
 <MetricCard icon={Radio} label="THD" value={latestReading.thd != null ? latestReading.thd.toFixed(1) : null} unit="%"
 color={latestReading.thd > 8 ? 'bg-red-50' : latestReading.thd > 5 ? 'bg-orange-50' : 'bg-blue-50'} />
 <MetricCard icon={Zap} label="Relay Chatter" value={latestReading.relay_chatter_ms != null ? latestReading.relay_chatter_ms.toFixed(0) : null} unit="ms"
 color={latestReading.relay_chatter_ms > 200 ? 'bg-red-50' : latestReading.relay_chatter_ms > 50 ? 'bg-orange-50' : 'bg-blue-50'} />
 <MetricCard icon={Battery} label="Battery" value={latestReading.battery_voltage != null ? latestReading.battery_voltage.toFixed(2) : null} unit="V"
 color={latestReading.battery_voltage < 2.5 ? 'bg-red-50' : latestReading.battery_voltage < 2.8 ? 'bg-orange-50' : 'bg-blue-50'} />
 <MetricCard icon={Thermometer} label="VOC Gas" value={latestReading.voc_ppm != null ? latestReading.voc_ppm.toFixed(1) : null} unit="ppm"
 color={latestReading.voc_ppm > 150 ? 'bg-red-50' : latestReading.voc_ppm > 50 ? 'bg-orange-50' : 'bg-blue-50'} />
 {latestReading.firmware_heap_pct != null && (
 <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
 <div className={`p-2 rounded-lg ${latestReading.firmware_heap_pct > 95 ? 'bg-red-50' : latestReading.firmware_heap_pct > 80 ? 'bg-orange-50' : 'bg-blue-50'}`}>
 <Cpu className="w-4 h-4 text-[#0071E3]"/>
 </div>
 <div className="flex-1">
 <p className="text-xs text-gray-500">Firmware Heap</p>
 <div className="flex items-center gap-2 mt-0.5">
 <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
 <div className={`h-full rounded-full ${latestReading.firmware_heap_pct > 95 ? 'bg-red-500' : latestReading.firmware_heap_pct > 80 ? 'bg-orange-500' : 'bg-green-500'}`}
 style={{ width: `${Math.min(latestReading.firmware_heap_pct, 100)}%` }} />
 </div>
 <span className="text-xs font-semibold text-gray-900">{latestReading.firmware_heap_pct.toFixed(0)}%</span>
 </div>
 </div>
 </div>
 )}
 </div>
 )}  {/* Telemetry Chart */}
 <div className="card p-5 mb-6">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-sm font-semibold text-gray-700">Telemetry Data</h3>
 <div className="flex gap-1 flex-wrap">
 {chartOptions.map((opt) => (
 <button
 key={opt.key}
 onClick={() => setActiveChart(opt.key)}
 className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
 activeChart === opt.key ? 'bg-[#0071E3] text-white' : 'bg-gray-50 text-gray-500 hover:text-gray-700 hover:bg-gray-100'
 }`}
 >
 {opt.label}
 </button>
 ))}
 </div>
 </div>
 <div className="h-72">
 <ResponsiveContainer width="100%"height="100%">
 <AreaChart data={readings}>
 <defs>
 <linearGradient id="chartGrad"x1="0"y1="0"x2="0"y2="1">
 <stop offset="0%"stopColor={chartOptions.find(c => c.key === activeChart)?.color} stopOpacity={0.3} />
 <stop offset="100%"stopColor={chartOptions.find(c => c.key === activeChart)?.color} stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3"stroke="#E5E5EA"strokeOpacity={0.5} />
 <XAxis dataKey="time"tick={{ fill: '#86868B', fontSize: 11 }} axisLine={{ stroke: '#E5E5EA' }} tickLine={false} />
 <YAxis tick={{ fill: '#86868B', fontSize: 11 }} axisLine={false} tickLine={false} />
 <Tooltip content={<CustomTooltip />} />
 {activeChart === 'thd' && <ReferenceLine y={5} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'CEA 5%', fill: '#f59e0b', fontSize: 10 }} />}
 {activeChart === 'thd' && <ReferenceLine y={8} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Critical 8%', fill: '#ef4444', fontSize: 10 }} />}
 {activeChart === 'relay_chatter_ms' && <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Warning 50ms', fill: '#f59e0b', fontSize: 10 }} />}
 {activeChart === 'relay_chatter_ms' && <ReferenceLine y={200} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Critical 200ms', fill: '#ef4444', fontSize: 10 }} />}
 {activeChart === 'battery_voltage' && <ReferenceLine y={2.8} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Warning 2.8V', fill: '#f59e0b', fontSize: 10 }} />}
 {activeChart === 'battery_voltage' && <ReferenceLine y={2.5} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Critical 2.5V', fill: '#ef4444', fontSize: 10 }} />}
 {activeChart === 'voc_ppm' && <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Warning 50 ppm', fill: '#f59e0b', fontSize: 10 }} />}
 {activeChart === 'voc_ppm' && <ReferenceLine y={150} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Critical 150 ppm', fill: '#ef4444', fontSize: 10 }} />}
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
 </div>  {/* Predictive Maintenance Forecast */}
 <div className="card p-5 mb-6">
 <div className="flex items-center gap-2 mb-1">
 <TrendingUp className="w-4 h-4 text-[#5AC8FA]"/>
 <h3 className="text-sm font-semibold text-gray-700">Predictive Maintenance Forecast</h3>
 </div>
 <p className="text-xs text-gray-400 mb-4">ML model projects health trajectory based on current telemetry patterns and historical degradation rates.</p>
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Forecast Chart — 2/3 width */}
 <div className="lg:col-span-2">
 {forecastData.length > 0 ? (
 <div className="h-56">
 <ResponsiveContainer width="100%"height="100%">
 <AreaChart data={forecastData}>
 <defs>
 <linearGradient id="forecastGrad"x1="0"y1="0"x2="0"y2="1">
 <stop offset="0%"stopColor="#06b6d4"stopOpacity={0.3} />
 <stop offset="100%"stopColor="#06b6d4"stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3"stroke="#E5E5EA"strokeOpacity={0.5} />
 <XAxis dataKey="day"tick={{ fill: '#86868B', fontSize: 11 }} axisLine={{ stroke: '#E5E5EA' }} tickLine={false} />
 <YAxis domain={[0, 100]} tick={{ fill: '#86868B', fontSize: 11 }} axisLine={false} tickLine={false} />
 <Tooltip content={<CustomTooltip />} />
 <Area type="monotone"dataKey="upper"name="Upper Bound"stroke="none"fill="#06b6d420"/>
 <Area type="monotone"dataKey="lower"name="Lower Bound"stroke="none"fill="#06b6d410"/>
 <Line type="monotone"dataKey="health"name="Predicted"stroke="#06b6d4"strokeWidth={2} dot={{ fill: '#06b6d4', r: 3 }} />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 ) : (
 <div className="flex items-center justify-center h-56 text-gray-500 text-sm">
 Insufficient data for forecasting
 </div>
 )}
 {forecast?.trend && (
 <div className="mt-3 p-2.5 rounded-lg bg-gray-50 border border-gray-200">
 <p className="text-xs text-gray-600">
 <span className="font-medium">ML Prediction:</span>{' '}
 Health trend is{' '}<span className={forecast.trend === 'declining' ? 'text-red-500 font-semibold' : forecast.trend === 'stable' ? 'text-green-600 font-semibold' : 'text-orange-500 font-semibold'}>{forecast.trend}</span>
 {forecast.days_to_critical && <span>. Estimated to reach critical threshold in <span className="text-red-500 font-semibold">{forecast.days_to_critical} days</span> — schedule preventive maintenance before failure</span>}
 {!forecast.days_to_critical && forecast.trend === 'stable' && <span>. No intervention required at this time.</span>}
 </p>
 </div>
 )}
 </div>

 {/* Remaining Life — 1/3 width */}
 <div>
 {remainingLife ? (
 <div className="space-y-3">
 <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
 <p className="text-xs text-gray-500 mb-1">Estimated Remaining Life</p>
 <p className="text-2xl font-bold text-gray-900">{remainingLife.remaining_days || '—'} <span className="text-sm text-gray-400">days</span></p>
 <p className="text-xs text-gray-500 mt-1">{remainingLife.remaining_years?.toFixed(1) || '—'} years</p>
 </div>
 <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
 <p className="text-xs text-gray-500 mb-1">Battery Health</p>
 <div className="flex items-center gap-3">
 <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
 <div
 className={`h-full rounded-full ${(remainingLife.battery_health || 0) >= 0.7 ? 'bg-green-500' : (remainingLife.battery_health || 0) >= 0.4 ? 'bg-orange-500' : 'bg-red-500'}`}
 style={{ width: `${Math.round((remainingLife.battery_health || 0) * 100)}%` }}
 />
 </div>
 <span className="text-sm font-medium text-gray-900">{Math.round((remainingLife.battery_health || 0) * 100)}%</span>
 </div>
 </div>
 <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
 <p className="text-xs text-gray-500 mb-1">Health Decay Rate</p>
 <p className="text-sm font-medium text-gray-700">{remainingLife.decay_rate_per_day?.toFixed(5) || '—'} <span className="text-xs text-gray-500">per day</span></p>
 </div>
 </div>
 ) : (
 <div className="flex items-center justify-center h-40 text-gray-500 text-sm">Loading...</div>
 )}
 </div>
 </div>
 </div>  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
 {/* Health History */}
 <div className="card p-5">
 <h3 className="text-sm font-semibold text-gray-700 mb-4">Health Score History</h3>
 <div className="h-56">
 {healthHistory.length > 0 ? (
 <ResponsiveContainer width="100%"height="100%">
 <LineChart data={healthHistory}>
 <CartesianGrid strokeDasharray="3 3"stroke="#E5E5EA"strokeOpacity={0.5} />
 <XAxis dataKey="time"tick={{ fill: '#86868B', fontSize: 11 }} axisLine={{ stroke: '#E5E5EA' }} tickLine={false} />
 <YAxis domain={[0, 100]} tick={{ fill: '#86868B', fontSize: 11 }} axisLine={false} tickLine={false} />
 <Tooltip content={<CustomTooltip />} />
 <Line type="monotone"dataKey="score"name="Health %"stroke="#06b6d4"strokeWidth={2} dot={{ fill: '#06b6d4', r: 3 }} activeDot={{ r: 5 }} />
 </LineChart>
 </ResponsiveContainer>
 ) : (
 <div className="flex items-center justify-center h-full text-gray-500 text-sm">No health history</div>
 )}
 </div>
 </div>  {/* Network Neighbors & Mesh Consensus */}
 <div className="card p-5">
 <div className="flex items-center gap-2 mb-4">
 <Network className="w-4 h-4 text-purple-600"/>
 <h3 className="text-sm font-semibold text-gray-700">Mesh Consensus</h3>
 </div>
 {neighbors ? (
 <div className="space-y-3">
 <div className={`p-3 rounded-xl border ${neighbors.analysis === 'local_issue' ? 'bg-orange-50 border-orange-200' : neighbors.analysis === 'grid_wide_issue' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
 <p className="text-xs text-gray-600 mb-1">Network Verdict</p>
 <p className={`text-sm font-semibold ${neighbors.analysis === 'local_issue' ? 'text-orange-600' : neighbors.analysis === 'grid_wide_issue' ? 'text-red-600' : 'text-green-600'}`}>
 {neighbors.analysis === 'local_issue' ? '⚠ Localized Issue — Meter-Specific Fault' : neighbors.analysis === 'grid_wide_issue' ? '🔴 Grid-Wide Issue — Upstream Problem' : '✓ Normal Operating Conditions'}
 </p>
 <p className="text-[10px] text-gray-500 mt-1">{neighbors.explanation}</p>
 </div>
 <div className="space-y-2 max-h-40 overflow-y-auto">
 <p className="text-[10px] text-gray-400 uppercase tracking-wider">Neighbor Comparison</p>
 {neighbors.neighbors?.map((n) => {
 const nPct = Math.round(n.health * 100);
 return (
 <Link key={n.meter_id} to={`/meters/${n.meter_id}`} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 hover:bg-white transition-colors">
 <span className="text-xs text-gray-600 w-20 truncate">{n.meter_id}</span>
 <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
 <div className={`h-full rounded-full ${nPct >= 70 ? 'bg-green-500' : nPct >= 40 ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${nPct}%` }} />
 </div>
 <span className={`text-xs font-medium tabular-nums ${nPct >= 70 ? 'text-green-600' : nPct >= 40 ? 'text-orange-500' : 'text-red-500'}`}>{nPct}%</span>
 </Link>
 );
 })}
 </div>
 </div>
 ) : (
 <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading...</div>
 )}
 </div>  {/* Component Health (mini digital twin) */}
 <div className="card p-5">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <Box className="w-4 h-4 text-[#5AC8FA]"/>
 <h3 className="text-sm font-semibold text-gray-700">Component Health</h3>
 </div>
 <Link to={`/digital-twin?meter=${meter.id}`} className="text-[10px] text-[#0071E3] hover:text-blue-600">3D View →</Link>
 </div>
 {twinData?.components ? (
 <div className="space-y-2.5">
 {Object.entries(twinData.components).map(([key, health]) => {
 const pct = Math.round(health * 100);
 return (
 <div key={key} className="flex items-center gap-3">
 <span className="text-xs text-gray-400 capitalize w-24 truncate">{key.replace(/_/g, ' ')}</span>
 <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
 <div
 className={`h-full rounded-full ${pct >= 85 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : pct >= 35 ? 'bg-orange-500' : 'bg-red-500'}`}
 style={{ width: `${pct}%` }}
 />
 </div>
 <span className={`text-xs font-medium tabular-nums ${pct >= 85 ? 'text-green-600' : pct >= 60 ? 'text-[#0071E3]' : pct >= 35 ? 'text-orange-500' : 'text-red-500'}`}>{pct}%</span>
 </div>
 );
 })}
 </div>
 ) : (
 <div className="flex items-center justify-center h-40 text-gray-500 text-sm">Loading...</div>
 )}
 </div>
 </div>  {/* Anomalies */}
 <div className="card p-5">
 <h3 className="text-sm font-semibold text-gray-700 mb-4">
 Anomaly History
 {anomalies.length > 0 && <span className="ml-2 text-xs text-gray-500">({anomalies.length} records)</span>}
 </h3>
 <div className="space-y-2 max-h-64 overflow-y-auto">
 {anomalies.length === 0 ? (
 <p className="text-sm text-gray-500 text-center py-8">No anomalies detected</p>
 ) : (
 anomalies.map((anomaly) => (
 <div key={anomaly.id} className="p-3 rounded-xl bg-gray-50 border border-gray-200">
 <div className="flex items-start justify-between">
 <div className="flex items-center gap-2">
 <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${getSeverityBgColor(anomaly.risk_level)}`}>
 {anomaly.risk_level}
 </span>
 {anomaly.suspected_issue && <span className="text-xs text-gray-600">{formatIssueLabel(anomaly.suspected_issue)}</span>}
 </div>
 <div className="flex items-center gap-1">
 {anomaly.resolved ? <CheckCircle className="w-3.5 h-3.5 text-green-600"/> : <XCircle className="w-3.5 h-3.5 text-red-500"/>}
 </div>
 </div>
 <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-500">
 <span>Score: {(anomaly.anomaly_score * 100).toFixed(1)}%</span>
 <span>{formatDate(anomaly.detected_at)}</span>
 </div>
 {anomaly.contributing_factors && Array.isArray(anomaly.contributing_factors) && (
 <div className="flex flex-wrap gap-1 mt-1.5">
 {anomaly.contributing_factors.slice(0, 4).map((f, i) => (
 <span key={i} className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] text-gray-400">
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

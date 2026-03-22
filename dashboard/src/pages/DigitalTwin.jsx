import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
 Activity,
 AlertTriangle,
 Battery,
 Box,
 Cpu,
 Monitor,
 Wifi,
 Zap,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { digitalTwinAPI, metersAPI } from '../services/api';
import { formatIssueLabel } from '../utils/helpers';

const COMPONENT_META = {
 terminals: { label: 'Terminals', icon: Zap, position: { top: '18%', left: '11%' } },
 power_supply: { label: 'Power Supply', icon: Activity, position: { top: '42%', left: '11%' } },
 display: { label: 'Display', icon: Monitor, position: { top: '18%', left: '52%' } },
 battery: { label: 'Battery & RTC', icon: Battery, position: { top: '42%', left: '52%' } },
 relay: { label: 'Relay', icon: Cpu, position: { top: '18%', left: '84%' } },
 communication: { label: 'Communication', icon: Wifi, position: { top: '42%', left: '84%' } },
};

function healthTone(score) {
 if (score >= 0.85) {
 return {
 color: '#10b981',
 card: 'border-green-200 bg-green-50',
 text: 'text-green-600',
 };
 }
 if (score >= 0.6) {
 return {
 color: '#3b82f6',
 card: 'border-blue-200 bg-blue-50',
 text: 'text-[#0071E3]',
 };
 }
 if (score >= 0.35) {
 return {
 color: '#f59e0b',
 card: 'border-orange-200 bg-orange-50',
 text: 'text-orange-500',
 };
 }
 return {
 color: '#ef4444',
 card: 'border-red-200 bg-red-50',
 text: 'text-red-500',
 };
}

function getOverallStatusLabel(score) {
 if (score >= 0.85) return 'Healthy';
 if (score >= 0.6) return 'Stable with watchpoints';
 if (score >= 0.35) return 'Degraded';
 return 'Immediate maintenance recommended';
}

function ComponentNode({ componentKey, score, active, onClick }) {
 const meta = COMPONENT_META[componentKey];
 const Icon = meta?.icon || Box;
 const tone = healthTone(score);  return (
 <button
 type="button"
 onClick={onClick}
 className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-3 text-left shadow-lg transition-all ${
 active
 ? `${tone.card} scale-[1.03] shadow-black/25`
 : 'border-gray-200 bg-gray-50 hover:border-gray-300'
 }`}
 style={meta?.position}
 >
 <div className="flex items-center gap-2">
 <div
 className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10"
 style={{ backgroundColor: `${tone.color}20` }}
 >
 <Icon className="w-4 h-4"style={{ color: tone.color }} />
 </div>
 <div>
 <p className="text-xs font-semibold text-gray-900">{meta?.label || componentKey}</p>
 <p className={`text-[11px] ${tone.text}`}>{Math.round(score * 100)}%</p>
 </div>
 </div>
 </button>
 );
}

export default function DigitalTwin() {
 const [searchParams] = useSearchParams();
 const [meters, setMeters] = useState([]);
 const [selectedMeter, setSelectedMeter] = useState('');
 const [twinData, setTwinData] = useState(null);
 const [selectedComponent, setSelectedComponent] = useState(null);
 const [loading, setLoading] = useState(true);  useEffect(() => {
 async function loadMeters() {
 try {
 const res = await metersAPI.list();
 const meterList = res.data?.meters || [];
 setMeters(meterList);  if (meterList.length > 0) {
 const requestedId = searchParams.get('meter');
 const requestedMeter = meterList.find((meter) => meter.id === requestedId);
 const defaultMeter = requestedMeter || meterList.find((meter) => meter.status !== 'healthy') || meterList[0];
 setSelectedMeter(defaultMeter.id);
 }
 } catch (error) {
 console.error('Failed to load twin meters:', error);
 }
 }  loadMeters();
 }, [searchParams]);  useEffect(() => {
 if (!selectedMeter) return;  async function loadTwin() {
 setLoading(true);
 try {
 const res = await digitalTwinAPI.get(selectedMeter);
 const data = res.data;
 setTwinData(data);  const componentEntries = Object.entries(data?.components || {});
 if (componentEntries.length > 0) {
 const [lowestKey] = componentEntries.reduce((lowest, current) => (
 current[1] < lowest[1] ? current : lowest
 ));
 setSelectedComponent(lowestKey);
 }
 } catch (error) {
 console.error('Failed to load digital twin:', error);
 } finally {
 setLoading(false);
 }
 }  loadTwin();
 }, [selectedMeter]);  const componentScores = twinData?.components || {};
 const componentDetails = twinData?.component_details || {};
 const currentDetail = selectedComponent ? componentDetails[selectedComponent] : null;
 const overallHealth = twinData?.overall_health || 0;
 const overallTone = healthTone(overallHealth);  const componentEntries = useMemo(
 () => Object.entries(componentScores).sort((a, b) => a[1] - b[1]),
 [componentScores],
 );  return (
 <div data-tour="digital-twin-page">
 <PageHeader title="Digital Twin"subtitle="Component-level health view for the active smart meter">
 <select
 value={selectedMeter}
 onChange={(event) => setSelectedMeter(event.target.value)}
 className="input-field w-60"
 >
 {meters.map((meter) => (
 <option key={meter.id} value={meter.id}>
 {meter.name} ({meter.id})
 </option>
 ))}
 </select>
 </PageHeader>  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
 <div className="card p-4">
 <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Overall Health</p>
 <p className={`text-2xl font-bold ${overallTone.text}`}>{Math.round(overallHealth * 100)}%</p>
 <p className="text-xs text-gray-400 mt-1">{getOverallStatusLabel(overallHealth)}</p>
 </div>
 <div className="card p-4">
 <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Suspected Issue</p>
 <p className="text-sm font-semibold text-gray-900">{twinData?.suspected_issue ? formatIssueLabel(twinData.suspected_issue) : 'No active issue'}</p>
 </div>
 <div className="card p-4">
 <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Weakest Component</p>
 <p className="text-sm font-semibold text-gray-900">
 {componentEntries[0] ? (COMPONENT_META[componentEntries[0][0]]?.label || componentEntries[0][0]) : 'N/A'}
 </p>
 <p className="text-xs text-gray-400 mt-1">
 {componentEntries[0] ? `${Math.round(componentEntries[0][1] * 100)}% health` : 'Waiting for twin data'}
 </p>
 </div>
 <div className="card p-4">
 <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Field Validation</p>
 <p className="text-sm font-semibold text-gray-900">VLM-ready</p>
 <p className="text-xs text-gray-400 mt-1">Use the mobile app to capture video for visual AI confirmation</p>
 </div>
 </div>  <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-6">
 <div className="card p-5">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h3 className="text-sm font-semibold text-gray-900">Meter Component Schematic</h3>
 <p className="text-xs text-gray-500">A stable component twin driven by the backend health diagnostics API</p>
 </div>
 </div>  {loading ? (
 <div className="h-[360px] rounded-2xl bg-gray-50 border border-gray-200 animate-pulse"/>
 ) : (
 <div className="relative h-[360px] rounded-[28px] border border-gray-200 overflow-hidden bg-[radial-gradient(circle_at_top,#21325d,transparent_45%),linear-gradient(180deg,#111a34,#0b1022)]">
 {/* Connection lines from center to each component */}
 <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
   {componentEntries.map(([key, score]) => {
     const pos = COMPONENT_META[key]?.position;
     if (!pos) return null;
     const x = parseFloat(pos.left);
     const y = parseFloat(pos.top);
     const tone = healthTone(score);
     return (
       <line key={key} x1="50" y1="54" x2={x} y2={y}
         stroke={tone.color} strokeWidth="0.3" strokeDasharray="1 0.8" opacity={selectedComponent === key ? 0.9 : 0.35} />
     );
   })}
 </svg>
 {/* Central meter display */}
 <div className="absolute inset-x-1/2 top-[54%] h-auto w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-gray-200 bg-gray-50 shadow-2xl shadow-black/30 p-4 z-10">
 <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-center mb-3">
 <p className="text-[10px] uppercase tracking-wider text-cyan-600">Live meter twin</p>
 <p className="text-base font-semibold text-gray-900">{twinData?.meter_id}</p>
 </div>
 <div className="grid grid-cols-2 gap-2 text-xs">
 <div>
 <p className="text-gray-500">Name</p>
 <p className="text-gray-900 mt-0.5">{twinData?.meter_name}</p>
 </div>
 <div>
 <p className="text-gray-500">Status</p>
 <p className={`mt-0.5 font-medium ${overallTone.text}`}>{twinData?.overall_status}</p>
 </div>
 </div>
 </div>

 {componentEntries.map(([componentKey, score]) => (
 <ComponentNode
 key={componentKey}
 componentKey={componentKey}
 score={score}
 active={selectedComponent === componentKey}
 onClick={() => setSelectedComponent(componentKey)}
 />
 ))}
 </div>
 )}
 </div>  <div className="space-y-4">
 <div className="card p-4">
 <h3 className="text-sm font-semibold text-gray-900 mb-3">Component Ranking</h3>
 <div className="space-y-2">
 {componentEntries.map(([componentKey, score]) => {
 const meta = COMPONENT_META[componentKey];
 const tone = healthTone(score);
 return (
 <button
 key={componentKey}
 type="button"
 onClick={() => setSelectedComponent(componentKey)}
 className={`w-full rounded-xl border p-3 text-left transition-colors ${
 selectedComponent === componentKey
 ? tone.card
 : 'border-gray-200 bg-gray-50 hover:border-gray-300'
 }`}
 >
 <div className="flex items-center justify-between gap-3">
 <div>
 <p className="text-sm font-semibold text-gray-900">{meta?.label || componentKey}</p>
 <p className="text-[11px] text-gray-500">{Math.round(score * 100)}% health</p>
 </div>
 {score < 0.35 && <AlertTriangle className="w-4 h-4 text-red-500"/>}
 </div>
 </button>
 );
 })}
 </div>
 </div>  <div className="card p-4">
 <h3 className="text-sm font-semibold text-gray-900 mb-3">
 {currentDetail?.name || 'Component details'}
 </h3>  {currentDetail ? (
 <motion.div
 key={selectedComponent}
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 className="space-y-3"
 >
 <div className={`rounded-xl border p-3 ${healthTone(currentDetail.health_score).card}`}>
 <p className="text-xs text-gray-600 mb-1">Health status</p>
 <p className={`text-lg font-semibold ${healthTone(currentDetail.health_score).text}`}>
 {Math.round(currentDetail.health_score * 100)}%
 </p>
 </div>  {Object.entries(currentDetail.details || {}).map(([detailKey, value]) => {
 const isArrayLike = Array.isArray(value) || (typeof value === 'object' && value !== null && Object.keys(value).every(k => !isNaN(k)));
 const isTrendField = detailKey === 'chatter_trend' || detailKey === 'discharge_curve';
 const asArray = isArrayLike ? (Array.isArray(value) ? value : Object.values(value)) : null;

 return (
 <div key={detailKey} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
 <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">
 {detailKey.replace(/_/g, ' ')}
 </p>
 {isTrendField && asArray && asArray.length > 0 ? (
 <div>
 <div className="flex items-end gap-px h-10 mb-1">
 {asArray.slice(-12).map((point, idx) => {
 const val = point?.chatter_ms ?? point?.voltage ?? 0;
 const maxVal = Math.max(...asArray.slice(-12).map(p => p?.chatter_ms ?? p?.voltage ?? 1));
 const h = maxVal > 0 ? Math.max(4, (val / maxVal) * 100) : 50;
 return <div key={idx} className="flex-1 rounded-sm bg-blue-400/60" style={{ height: `${h}%` }} title={`${val}`} />;
 })}
 </div>
 <p className="text-xs text-gray-400">{asArray.length} data points &middot; latest: {asArray[asArray.length-1]?.chatter_ms?.toFixed(1) ?? asArray[asArray.length-1]?.voltage?.toFixed(3) ?? '—'}{detailKey === 'chatter_trend' ? ' ms' : ' V'}</p>
 </div>
 ) : isArrayLike && asArray ? (
 <p className="text-sm text-gray-500 italic">{asArray.length} data points recorded</p>
 ) : typeof value === 'object' && value !== null ? (
 <div className="space-y-1">
 {Object.entries(value).map(([k, v]) => (
 <div key={k} className="flex items-center justify-between text-sm">
 <span className="text-gray-500 capitalize">{String(k).replace(/_/g, ' ')}</span>
 <span className="text-gray-900 font-medium">{typeof v === 'number' ? v.toFixed(2) : String(v)}</span>
 </div>
 ))}
 </div>
 ) : (
 <p className="text-sm text-gray-900">{typeof value === 'number' ? value.toFixed(2) : String(value)}</p>
 )}
 </div>
 );
 })}  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
 <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Risk factors</p>
 {currentDetail.risk_factors?.length ? (
 <div className="space-y-2">
 {currentDetail.risk_factors.map((risk) => (
 <div key={risk} className="text-sm text-amber-700 flex items-start gap-2"><span className="text-amber-500 mt-0.5 shrink-0">⚠</span>{risk}</div>
 ))}
 </div>
 ) : (
 <p className="text-sm text-gray-400">No elevated risk factors on the latest telemetry.</p>
 )}
 </div>
 </motion.div>
 ) : (
 <p className="text-sm text-gray-500">Select a component to inspect the twin data.</p>
 )}
 </div>
 </div>
 </div>
    </div>
  );
}

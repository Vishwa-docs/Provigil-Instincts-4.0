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

const COMPONENT_META = {
  terminals: { label: 'Terminals', icon: Zap, position: { top: '16%', left: '9%' } },
  power_supply: { label: 'Power Supply', icon: Activity, position: { top: '38%', left: '10%' } },
  display: { label: 'Display', icon: Monitor, position: { top: '18%', left: '50%' } },
  battery: { label: 'Battery & RTC', icon: Battery, position: { top: '20%', left: '78%' } },
  relay: { label: 'Relay', icon: Cpu, position: { top: '46%', left: '76%' } },
  communication: { label: 'Communication', icon: Wifi, position: { top: '68%', left: '52%' } },
};

function healthTone(score) {
  if (score >= 0.85) {
    return {
      color: '#10b981',
      card: 'border-emerald-500/30 bg-emerald-500/10',
      text: 'text-emerald-400',
    };
  }
  if (score >= 0.6) {
    return {
      color: '#3b82f6',
      card: 'border-blue-500/30 bg-blue-500/10',
      text: 'text-blue-400',
    };
  }
  if (score >= 0.35) {
    return {
      color: '#f59e0b',
      card: 'border-amber-500/30 bg-amber-500/10',
      text: 'text-amber-400',
    };
  }
  return {
    color: '#ef4444',
    card: 'border-red-500/30 bg-red-500/10',
    text: 'text-red-400',
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
  const tone = healthTone(score);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-3 text-left shadow-lg transition-all ${
        active
          ? `${tone.card} scale-[1.03] shadow-black/25`
          : 'border-navy-700/40 bg-navy-900/70 hover:border-navy-500/50'
      }`}
      style={meta?.position}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10"
          style={{ backgroundColor: `${tone.color}20` }}
        >
          <Icon className="w-4 h-4" style={{ color: tone.color }} />
        </div>
        <div>
          <p className="text-xs font-semibold text-white">{meta?.label || componentKey}</p>
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMeters() {
      try {
        const res = await metersAPI.list();
        const meterList = res.data?.meters || [];
        setMeters(meterList);

        if (meterList.length > 0) {
          const requestedId = searchParams.get('meter');
          const requestedMeter = meterList.find((meter) => meter.id === requestedId);
          const defaultMeter = requestedMeter || meterList.find((meter) => meter.status !== 'healthy') || meterList[0];
          setSelectedMeter(defaultMeter.id);
        }
      } catch (error) {
        console.error('Failed to load twin meters:', error);
      }
    }

    loadMeters();
  }, [searchParams]);

  useEffect(() => {
    if (!selectedMeter) return;

    async function loadTwin() {
      setLoading(true);
      try {
        const res = await digitalTwinAPI.get(selectedMeter);
        const data = res.data;
        setTwinData(data);

        const componentEntries = Object.entries(data?.components || {});
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
    }

    loadTwin();
  }, [selectedMeter]);

  const componentScores = twinData?.components || {};
  const componentDetails = twinData?.component_details || {};
  const currentDetail = selectedComponent ? componentDetails[selectedComponent] : null;
  const overallHealth = twinData?.overall_health || 0;
  const overallTone = healthTone(overallHealth);

  const componentEntries = useMemo(
    () => Object.entries(componentScores).sort((a, b) => a[1] - b[1]),
    [componentScores],
  );

  return (
    <>
      <PageHeader title="Digital Twin" subtitle="Component-level health view for the active smart meter">
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
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Overall Health</p>
          <p className={`text-2xl font-bold ${overallTone.text}`}>{Math.round(overallHealth * 100)}%</p>
          <p className="text-xs text-gray-400 mt-1">{getOverallStatusLabel(overallHealth)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Suspected Issue</p>
          <p className="text-sm font-semibold text-white">{twinData?.suspected_issue || 'No active issue'}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Weakest Component</p>
          <p className="text-sm font-semibold text-white">
            {componentEntries[0] ? (COMPONENT_META[componentEntries[0][0]]?.label || componentEntries[0][0]) : 'N/A'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {componentEntries[0] ? `${Math.round(componentEntries[0][1] * 100)}% health` : 'Waiting for twin data'}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Field Vision Hook</p>
          <p className="text-sm font-semibold text-white">VLM workflow ready</p>
          <p className="text-xs text-gray-400 mt-1">Designed to validate loose connections from field photos and videos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Meter Component Schematic</h3>
              <p className="text-xs text-gray-500">A stable component twin driven by the backend health diagnostics API</p>
            </div>
          </div>

          {loading ? (
            <div className="h-[560px] rounded-2xl bg-navy-900/60 border border-navy-700/40 animate-pulse" />
          ) : (
            <div className="relative h-[560px] rounded-[28px] border border-navy-700/40 overflow-hidden bg-[radial-gradient(circle_at_top,#21325d,transparent_45%),linear-gradient(180deg,#111a34,#0b1022)]">
              <div className="absolute inset-x-1/2 top-[14%] h-[62%] w-[38%] -translate-x-1/2 rounded-[32px] border border-navy-600/50 bg-navy-900/80 shadow-2xl shadow-black/30">
                <div className="absolute inset-x-[18%] top-[11%] h-[22%] rounded-2xl border border-cyan-500/20 bg-cyan-500/10 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-[11px] uppercase tracking-wider text-cyan-300/80">Live meter twin</p>
                    <p className="text-lg font-semibold text-white">{twinData?.meter_id}</p>
                  </div>
                </div>
                <div className="absolute inset-x-[14%] bottom-[12%] rounded-2xl border border-navy-700/40 bg-navy-950/80 p-4">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-gray-500">Name</p>
                      <p className="text-white mt-1">{twinData?.meter_name}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Status</p>
                      <p className={`mt-1 font-medium ${overallTone.text}`}>{twinData?.overall_status}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-[28%] top-[19%] h-[2px] w-[15%] bg-navy-600/60" />
                <div className="absolute left-[28%] top-[42%] h-[2px] w-[14%] bg-navy-600/60" />
                <div className="absolute left-[58%] top-[22%] h-[2px] w-[16%] bg-navy-600/60" />
                <div className="absolute left-[58%] top-[48%] h-[2px] w-[15%] bg-navy-600/60" />
                <div className="absolute left-[47%] top-[64%] h-[11%] w-[2px] bg-navy-600/60" />
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
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Component Ranking</h3>
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
                        : 'border-navy-700/40 bg-navy-900/70 hover:border-navy-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{meta?.label || componentKey}</p>
                        <p className="text-[11px] text-gray-500">{Math.round(score * 100)}% health</p>
                      </div>
                      {score < 0.35 && <AlertTriangle className="w-4 h-4 text-red-400" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-white mb-3">
              {currentDetail?.name || 'Component details'}
            </h3>

            {currentDetail ? (
              <motion.div
                key={selectedComponent}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className={`rounded-xl border p-3 ${healthTone(currentDetail.health_score).card}`}>
                  <p className="text-xs text-gray-300 mb-1">Health status</p>
                  <p className={`text-lg font-semibold ${healthTone(currentDetail.health_score).text}`}>
                    {Math.round(currentDetail.health_score * 100)}%
                  </p>
                </div>

                {Object.entries(currentDetail.details || {}).map(([detailKey, value]) => (
                  <div key={detailKey} className="rounded-xl border border-navy-700/40 bg-navy-900/60 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">
                      {detailKey.replace(/_/g, ' ')}
                    </p>
                    <p className="text-sm text-white">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </p>
                  </div>
                ))}

                <div className="rounded-xl border border-navy-700/40 bg-navy-900/60 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Risk factors</p>
                  {currentDetail.risk_factors?.length ? (
                    <div className="space-y-2">
                      {currentDetail.risk_factors.map((risk) => (
                        <div key={risk} className="text-sm text-amber-300">{risk}</div>
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
    </>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Filter,
  MapPinned,
  Network,
  Radar,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { metersAPI, networkAPI } from '../services/api';
import { formatRelativeDate, getStatusBgColor, getStatusColor } from '../utils/helpers';

const STATUS_COLORS = {
  healthy: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
};

const TYPE_COLORS = {
  feeder: '#8b5cf6',
  transformer: '#06b6d4',
  meter: '#3b82f6',
};

const CANVAS_WIDTH = 1100;
const CANVAS_HEIGHT = 620;

function buildProjectionBounds(nodes) {
  const lats = nodes.map((node) => node.lat).filter((value) => Number.isFinite(value));
  const lngs = nodes.map((node) => node.lng).filter((value) => Number.isFinite(value));

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
    latSpan: Math.max(maxLat - minLat, 0.01),
    lngSpan: Math.max(maxLng - minLng, 0.01),
  };
}

function projectPoint(lat, lng, bounds) {
  const x = 90 + ((lng - bounds.minLng) / bounds.lngSpan) * (CANVAS_WIDTH - 180);
  const y = 60 + (1 - (lat - bounds.minLat) / bounds.latSpan) * (CANVAS_HEIGHT - 120);
  return { x, y };
}

function buildVisibleNodeIds(topology, filteredMeters) {
  if (!topology?.nodes) return new Set();

  const nodeMap = Object.fromEntries(topology.nodes.map((node) => [node.id, node]));
  const visible = new Set();

  if (filteredMeters.length === 0) {
    topology.nodes.forEach((node) => visible.add(node.id));
    return visible;
  }

  filteredMeters.forEach((meter) => {
    let currentId = meter.id;
    while (currentId && !visible.has(currentId)) {
      visible.add(currentId);
      currentId = nodeMap[currentId]?.parent_id || null;
    }
  });

  return visible;
}

function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusBgColor(status)}`}>
      {status}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, accent = 'text-blue-400' }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-navy-900/70 border border-navy-700/40">
          <Icon className={`w-4 h-4 ${accent}`} />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-gray-500">{label}</p>
          <p className="text-lg font-semibold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function MapView() {
  const [meters, setMeters] = useState([]);
  const [topology, setTopology] = useState(null);
  const [networkHealth, setNetworkHealth] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [metersRes, topologyRes, healthRes] = await Promise.all([
          metersAPI.list(),
          networkAPI.getTopology(),
          networkAPI.getHealth(),
        ]);

        const meterList = metersRes.data?.meters || [];
        setMeters(meterList);
        setTopology(topologyRes.data);
        setNetworkHealth(healthRes.data || []);

        const criticalMeter = meterList.find((meter) => meter.status === 'critical');
        setSelectedNodeId(criticalMeter?.id || meterList[0]?.id || topologyRes.data?.nodes?.[0]?.id || null);
      } catch (error) {
        console.error('Failed to load network view:', error);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const filteredMeters = useMemo(() => {
    if (!statusFilter) return meters;
    return meters.filter((meter) => meter.status === statusFilter);
  }, [meters, statusFilter]);

  const visibleNodeIds = useMemo(
    () => buildVisibleNodeIds(topology, filteredMeters),
    [filteredMeters, topology],
  );

  const visibleNodes = useMemo(() => {
    if (!topology?.nodes) return [];
    return topology.nodes.filter((node) => visibleNodeIds.has(node.id));
  }, [topology, visibleNodeIds]);

  const visibleEdges = useMemo(() => {
    if (!topology?.edges) return [];
    return topology.edges.filter((edge) => (
      visibleNodeIds.has(edge.source || edge.from) && visibleNodeIds.has(edge.target || edge.to)
    ));
  }, [topology, visibleNodeIds]);

  const positionedNodes = useMemo(() => {
    if (!visibleNodes.length) return [];
    const bounds = buildProjectionBounds(visibleNodes);
    return visibleNodes.map((node) => ({
      ...node,
      ...projectPoint(node.lat, node.lng, bounds),
    }));
  }, [visibleNodes]);

  const positionedNodeMap = useMemo(
    () => Object.fromEntries(positionedNodes.map((node) => [node.id, node])),
    [positionedNodes],
  );

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return positionedNodeMap[selectedNodeId] || topology?.nodes?.find((node) => node.id === selectedNodeId) || null;
  }, [positionedNodeMap, selectedNodeId, topology]);

  const criticalMeters = useMemo(
    () => filteredMeters.filter((meter) => meter.status === 'critical').slice(0, 5),
    [filteredMeters],
  );

  const feederCount = networkHealth.filter((node) => node.type === 'feeder').length;
  const transformerCount = networkHealth.filter((node) => node.type === 'transformer').length;

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card h-[620px] animate-pulse" />
        <div className="space-y-4">
          <div className="card h-40 animate-pulse" />
          <div className="card h-48 animate-pulse" />
          <div className="card h-44 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Network Intelligence" subtitle="Localized feeder and transformer context for every smart meter">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-navy-700/40 bg-navy-900/70 px-3 py-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="bg-transparent text-sm text-gray-200 focus:outline-none"
            >
              <option value="">All meters</option>
              <option value="healthy">Healthy meters</option>
              <option value="warning">Warning meters</option>
              <option value="critical">Critical meters</option>
            </select>
          </div>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <MetricCard icon={MapPinned} label="Visible Meters" value={filteredMeters.length} accent="text-blue-400" />
        <MetricCard icon={Network} label="Grid Zones" value={`${feederCount + transformerCount}`} accent="text-cyan-400" />
        <MetricCard icon={Radar} label="Topology Links" value={visibleEdges.length} accent="text-purple-400" />
        <MetricCard icon={AlertTriangle} label="Critical Meter Risk" value={criticalMeters.length} accent="text-red-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.9fr_1fr] gap-6 mb-6">
        <div className="card p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Geospatial Network Canvas</h3>
              <p className="text-xs text-gray-500">Meters, transformers, and feeder links are projected from the seeded Delhi NCR fleet</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6]" />Feeder</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#06b6d4]" />Transformer</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />Meter</span>
            </div>
          </div>

          <div className="rounded-2xl border border-navy-700/40 bg-[radial-gradient(circle_at_top,#1b2a57,transparent_45%),linear-gradient(180deg,#0f1730,#0a1022)] overflow-hidden">
            <svg viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} className="w-full h-[620px]">
              <defs>
                <pattern id="network-grid" width="36" height="36" patternUnits="userSpaceOnUse">
                  <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#243255" strokeWidth="1" opacity="0.35" />
                </pattern>
              </defs>

              <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#network-grid)" />

              {visibleEdges.map((edge) => {
                const source = positionedNodeMap[edge.source || edge.from];
                const target = positionedNodeMap[edge.target || edge.to];
                if (!source || !target) return null;

                return (
                  <line
                    key={`${edge.source}-${edge.target}`}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke="#5476d6"
                    strokeWidth={source.type === 'feeder' || target.type === 'feeder' ? 4 : 2.5}
                    opacity={0.72}
                  />
                );
              })}

              {positionedNodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                const statusColor = node.type === 'meter'
                  ? (STATUS_COLORS[node.status] || TYPE_COLORS.meter)
                  : TYPE_COLORS[node.type];
                const radius = node.type === 'feeder' ? 18 : node.type === 'transformer' ? 13 : 10;

                return (
                  <g
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle cx={node.x} cy={node.y} r={radius + (isSelected ? 8 : 5)} fill={statusColor} opacity={isSelected ? 0.18 : 0.08} />
                    <circle cx={node.x} cy={node.y} r={radius} fill={statusColor} stroke={isSelected ? '#f8fafc' : '#0f172a'} strokeWidth={isSelected ? 3 : 2} />
                    <text x={node.x} y={node.y + radius + 18} textAnchor="middle" fill="#dbe3f2" fontSize="14" fontWeight="600">
                      {node.type === 'meter' ? node.id : node.id}
                    </text>
                    <text x={node.x} y={node.y + radius + 34} textAnchor="middle" fill="#7f93c6" fontSize="11">
                      {node.name.length > 22 ? `${node.name.slice(0, 22)}...` : node.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Selected Node</h3>
            {selectedNode ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-100">{selectedNode.name}</p>
                    <p className="text-xs font-mono text-gray-500">{selectedNode.id}</p>
                  </div>
                  <StatusPill status={selectedNode.status || selectedNode.type} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-navy-900/60 border border-navy-700/40 p-3">
                    <p className="text-gray-500 mb-1">Node Type</p>
                    <p className="text-white capitalize">{selectedNode.type}</p>
                  </div>
                  <div className="rounded-xl bg-navy-900/60 border border-navy-700/40 p-3">
                    <p className="text-gray-500 mb-1">Health</p>
                    <p className="text-white">{Math.round((selectedNode.health || selectedNode.health_score || 0) * 100)}%</p>
                  </div>
                </div>
                {selectedNode.type === 'meter' && (
                  <Link
                    to={`/meters/${selectedNode.id}`}
                    className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                  >
                    Open meter diagnostics
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Select a node to inspect the localized context.</p>
            )}
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-semibold text-white">Critical Meter Queue</h3>
            </div>
            <div className="space-y-2">
              {criticalMeters.length === 0 ? (
                <p className="text-sm text-gray-500">No critical meters in the current filter.</p>
              ) : criticalMeters.map((meter) => (
                <button
                  key={meter.id}
                  type="button"
                  onClick={() => setSelectedNodeId(meter.id)}
                  className="w-full text-left rounded-xl border border-navy-700/40 bg-navy-900/60 p-3 hover:border-red-500/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-100">{meter.name}</p>
                      <p className="text-xs font-mono text-gray-500">{meter.id}</p>
                    </div>
                    <span className={`text-xs font-medium ${getStatusColor(meter.status)}`}>
                      {Math.round(meter.health_score * 100)}%
                    </span>
                  </div>
                  {meter.suspected_issue && (
                    <p className="text-xs text-amber-400 mt-2">{meter.suspected_issue}</p>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Network Intelligence Summary</h3>
            </div>
            <div className="space-y-2 text-sm text-gray-300">
              <p><span className="text-gray-500">Feeders:</span> {feederCount}</p>
              <p><span className="text-gray-500">Transformers:</span> {transformerCount}</p>
              <p><span className="text-gray-500">Linked meters:</span> {meters.length}</p>
              <p className="text-xs text-gray-500 pt-2">
                Transformer-neighbor consensus helps separate localized meter issues from likely upstream grid problems.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-navy-700/40 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Meter Connectivity Table</h3>
            <p className="text-xs text-gray-500">Per-meter placement inside the localized feeder graph</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-navy-700/40">
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Meter</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Health</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Issue</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {filteredMeters.map((meter) => (
                <tr key={meter.id} className="border-b border-navy-800/40 hover:bg-navy-900/30 transition-colors">
                  <td className="px-5 py-3">
                    <Link to={`/meters/${meter.id}`} className="text-sm font-semibold text-gray-100 hover:text-blue-300">
                      {meter.name}
                    </Link>
                    <p className="text-xs font-mono text-gray-500 mt-0.5">{meter.id}</p>
                  </td>
                  <td className="px-5 py-3"><StatusPill status={meter.status} /></td>
                  <td className="px-5 py-3 text-sm text-white">{Math.round(meter.health_score * 100)}%</td>
                  <td className="px-5 py-3 text-sm text-amber-400">{meter.suspected_issue || 'Normal operating window'}</td>
                  <td className="px-5 py-3 text-sm text-gray-400">{formatRelativeDate(meter.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

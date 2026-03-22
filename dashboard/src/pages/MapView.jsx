import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, Radio, Zap, RefreshCw, AlertTriangle, ChevronRight,
  Activity, Search,
} from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import PageHeader from '../components/PageHeader';
import { networkAPI } from '../services/api';

const STATUS_COLORS = {
  healthy: '#34C759',
  warning: '#FF9500',
  critical: '#FF3B30',
};

const NODE_COLORS = {
  feeder: '#6366f1',
  transformer: '#8b5cf6',
  meter: '#64748b',
};

function healthColor(score) {
  if (score >= 0.85) return STATUS_COLORS.healthy;
  if (score >= 0.5) return STATUS_COLORS.warning;
  return STATUS_COLORS.critical;
}

function statusFromScore(score) {
  if (score >= 0.85) return 'healthy';
  if (score >= 0.5) return 'warning';
  return 'critical';
}

/* ---------- SVG graph layout helpers ---------- */
function layoutTree(nodes, edges) {
  const childMap = {};
  const parentMap = {};
  edges.forEach(e => {
    if (!childMap[e.source]) childMap[e.source] = [];
    childMap[e.source].push(e.target);
    parentMap[e.target] = e.source;
  });

  const roots = nodes.filter(n => !parentMap[n.id]);
  const positions = {};
  const LEVEL_HEIGHT = 140;
  const NODE_WIDTH = 160;

  function layout(nodeId, depth, xOffset) {
    const children = childMap[nodeId] || [];
    if (children.length === 0) {
      positions[nodeId] = { x: xOffset, y: depth * LEVEL_HEIGHT + 60 };
      return xOffset + NODE_WIDTH;
    }
    let currentX = xOffset;
    children.forEach(cid => {
      currentX = layout(cid, depth + 1, currentX);
    });
    const firstChild = positions[children[0]];
    const lastChild = positions[children[children.length - 1]];
    positions[nodeId] = {
      x: (firstChild.x + lastChild.x) / 2,
      y: depth * LEVEL_HEIGHT + 60,
    };
    return currentX;
  }

  let xCursor = 40;
  roots.forEach(root => {
    xCursor = layout(root.id, 0, xCursor);
  });

  return positions;
}

/* ---------- SVG Node ---------- */
function GraphNode({ node, pos, selected, onClick }) {
  const color = healthColor(node.health_score);
  const typeIcon = node.type === 'feeder' ? 'F' : node.type === 'transformer' ? 'T' : 'M';
  const radius = node.type === 'meter' ? 22 : node.type === 'transformer' ? 28 : 34;

  return (
    <g
      transform={`translate(${pos.x}, ${pos.y})`}
      onClick={() => onClick(node)}
      style={{ cursor: 'pointer' }}
    >
      {/* Outer ring for selection */}
      {selected && (
        <circle r={radius + 6} fill="none" stroke="#0071E3" strokeWidth={2.5} strokeDasharray="4 3" opacity={0.7} />
      )}
      {/* Health ring */}
      <circle r={radius + 2} fill="none" stroke={color} strokeWidth={2} opacity={0.5} />
      {/* Main circle */}
      <circle r={radius} fill="white" stroke={color} strokeWidth={2.5} />
      {/* Type indicator */}
      <text
        y={-4}
        textAnchor="middle"
        fill={NODE_COLORS[node.type] || '#64748b'}
        fontSize={node.type === 'meter' ? 11 : 13}
        fontWeight="700"
      >
        {typeIcon}
      </text>
      {/* Health score */}
      <text
        y={10}
        textAnchor="middle"
        fill={color}
        fontSize={10}
        fontWeight="600"
      >
        {Math.round(node.health_score * 100)}%
      </text>
      {/* Label below */}
      <text
        y={radius + 16}
        textAnchor="middle"
        fill="#374151"
        fontSize={9}
        fontWeight="500"
      >
        {(node.name || node.id).length > 18 ? (node.name || node.id).slice(0, 16) + '…' : (node.name || node.id)}
      </text>
      {/* Warning icon for critical */}
      {node.health_score < 0.5 && (
        <g transform={`translate(${radius - 4}, ${-radius + 4})`}>
          <circle r={7} fill="#FF3B30" />
          <text textAnchor="middle" y={4} fill="white" fontSize={9} fontWeight="bold">!</text>
        </g>
      )}
    </g>
  );
}

/* ---------- Network details panel ---------- */
function DetailPanel({ node, onClose }) {
  if (!node) return null;
  const color = healthColor(node.health_score);
  const status = statusFromScore(node.health_score);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-5 w-80">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {node.type === 'feeder' ? <Radio className="w-5 h-5" style={{ color }} /> :
           node.type === 'transformer' ? <Zap className="w-5 h-5" style={{ color }} /> :
           <Activity className="w-5 h-5" style={{ color }} />}
          <div>
            <p className="text-sm font-semibold text-gray-900">{node.name || node.id}</p>
            <p className="text-xs text-gray-500 capitalize">{node.type}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
          <span className="text-xs text-gray-500">Health Score</span>
          <span className="text-sm font-bold" style={{ color }}>{Math.round(node.health_score * 100)}%</span>
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
          <span className="text-xs text-gray-500">Status</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            status === 'healthy' ? 'bg-green-100 text-green-700' :
            status === 'warning' ? 'bg-orange-100 text-orange-700' :
            'bg-red-100 text-red-700'
          }`}>{status}</span>
        </div>
        {node.type === 'meter' && node.suspected_issue && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-xs text-amber-700">{node.suspected_issue}</span>
          </div>
        )}
        {node.lat != null && node.lng != null && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-xs text-gray-500">Coordinates</span>
            <span className="text-xs font-mono text-gray-700">{node.lat.toFixed(4)}, {node.lng.toFixed(4)}</span>
          </div>
        )}
        {node.children && node.children.length > 0 && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-xs text-gray-500">Connected nodes</span>
            <span className="text-xs font-medium text-gray-700">{node.children.length}</span>
          </div>
        )}
      </div>

      {node.type === 'meter' && (
        <Link
          to={`/meters/${node.id}`}
          className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-[#0071E3] text-white text-sm font-medium rounded-xl hover:bg-blue-600 transition-colors"
        >
          View Meter Detail <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}

/* ---------- Leaflet Map Component ---------- */
const NODE_RADIUS = { feeder: 14, transformer: 10, meter: 6 };
const NODE_FILL = { feeder: '#6366f1', transformer: '#8b5cf6', meter: '#64748b' };

function FitBounds({ nodes }) {
  const map = useMap();
  useEffect(() => {
    if (!nodes?.length) return;
    const lats = nodes.filter(n => n.lat != null).map(n => n.lat);
    const lngs = nodes.filter(n => n.lng != null).map(n => n.lng);
    if (lats.length === 0) return;
    map.fitBounds([[Math.min(...lats) - 0.02, Math.min(...lngs) - 0.02], [Math.max(...lats) + 0.02, Math.max(...lngs) + 0.02]]);
  }, [nodes, map]);
  return null;
}

function LeafletMap({ topology, selectedNode, onSelectNode }) {
  const nodes = topology?.nodes || [];
  const edges = topology?.edges || [];

  // Build a lookup for quick access
  const nodeMap = useMemo(() => {
    const m = {};
    nodes.forEach(n => { m[n.id] = n; });
    return m;
  }, [nodes]);

  // Build polylines from edges
  const polylines = useMemo(() => {
    return edges
      .map(e => {
        const src = nodeMap[e.source];
        const tgt = nodeMap[e.target];
        if (!src || !tgt || src.lat == null || tgt.lat == null) return null;
        const color = healthColor(tgt.health_score);
        return { positions: [[src.lat, src.lng], [tgt.lat, tgt.lng]], color };
      })
      .filter(Boolean);
  }, [edges, nodeMap]);

  const center = useMemo(() => {
    const validNodes = nodes.filter(n => n.lat != null);
    if (validNodes.length === 0) return [28.6139, 77.2090];
    const avgLat = validNodes.reduce((s, n) => s + n.lat, 0) / validNodes.length;
    const avgLng = validNodes.reduce((s, n) => s + n.lng, 0) / validNodes.length;
    return [avgLat, avgLng];
  }, [nodes]);

  return (
    <div style={{ height: 420 }}>
      <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds nodes={nodes} />

        {/* Connection lines */}
        {polylines.map((pl, i) => (
          <Polyline key={i} positions={pl.positions} pathOptions={{ color: pl.color, weight: 2, opacity: 0.5, dashArray: '6 4' }} />
        ))}

        {/* Nodes */}
        {nodes.filter(n => n.lat != null).map(node => {
          const color = healthColor(node.health_score);
          const fillColor = NODE_FILL[node.type] || '#64748b';
          const r = NODE_RADIUS[node.type] || 6;
          const isSelected = selectedNode?.id === node.id;

          return (
            <CircleMarker
              key={node.id}
              center={[node.lat, node.lng]}
              radius={r}
              pathOptions={{
                color: isSelected ? '#0071E3' : color,
                weight: isSelected ? 3 : 2,
                fillColor,
                fillOpacity: 0.85,
              }}
              eventHandlers={{ click: () => onSelectNode(node) }}
            >
              <Popup>
                <div className="text-xs min-w-[160px]">
                  <p className="font-semibold text-gray-900">{node.name || node.id}</p>
                  <p className="text-gray-500 capitalize">{node.type}</p>
                  <p className="mt-1">
                    Health: <span className="font-bold" style={{ color }}>{Math.round(node.health_score * 100)}%</span>
                  </p>
                  {node.suspected_issue && <p className="text-amber-600 mt-1">{node.suspected_issue}</p>}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}

/* ---------- Main MapView ---------- */
export default function MapView() {
  const [topology, setTopology] = useState(null);
  const [healthData, setHealthData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [search, setSearch] = useState('');
  const svgRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [topoRes, healthRes] = await Promise.all([
        networkAPI.getTopology(),
        networkAPI.getHealth(),
      ]);
      setTopology(topoRes.data);
      setHealthData(healthRes.data);
    } catch (err) {
      setError('Failed to load network topology. Ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const { positions, svgWidth, svgHeight, filteredNodes } = useMemo(() => {
    if (!topology?.nodes?.length) return { positions: {}, svgWidth: 800, svgHeight: 400, filteredNodes: [] };

    const nodes = topology.nodes;
    const edges = topology.edges || [];
    const pos = layoutTree(nodes, edges);

    let maxX = 0, maxY = 0;
    Object.values(pos).forEach(p => {
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });

    const fn = search
      ? nodes.filter(n => (n.name || n.id).toLowerCase().includes(search.toLowerCase()))
      : nodes;

    return {
      positions: pos,
      svgWidth: Math.max(800, maxX + 120),
      svgHeight: Math.max(400, maxY + 100),
      filteredNodes: fn,
    };
  }, [topology, search]);

  /* Summary stats */
  const summary = useMemo(() => {
    if (!topology?.nodes) return { feeders: 0, transformers: 0, meters: 0, healthy: 0, warning: 0, critical: 0 };
    const nodes = topology.nodes;
    return {
      feeders: nodes.filter(n => n.type === 'feeder').length,
      transformers: nodes.filter(n => n.type === 'transformer').length,
      meters: nodes.filter(n => n.type === 'meter').length,
      healthy: nodes.filter(n => n.health_score >= 0.85).length,
      warning: nodes.filter(n => n.health_score >= 0.5 && n.health_score < 0.85).length,
      critical: nodes.filter(n => n.health_score < 0.5).length,
    };
  }, [topology]);

  const highlightedIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);

  return (
    <div data-tour="network-map-page">
      <PageHeader title="Network Map" subtitle="Feeder → Transformer → Meter topology with real-time health">
        <button onClick={loadData} className="btn-secondary" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Feeders</p>
          <p className="text-lg font-bold text-indigo-600">{summary.feeders}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Transformers</p>
          <p className="text-lg font-bold text-purple-600">{summary.transformers}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Meters</p>
          <p className="text-lg font-bold text-gray-700">{summary.meters}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Healthy</p>
          <p className="text-lg font-bold" style={{ color: STATUS_COLORS.healthy }}>{summary.healthy}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Warning</p>
          <p className="text-lg font-bold" style={{ color: STATUS_COLORS.warning }}>{summary.warning}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Critical</p>
          <p className="text-lg font-bold" style={{ color: STATUS_COLORS.critical }}>{summary.critical}</p>
        </div>
      </div>

      {/* Leaflet geographic map */}
      {!loading && !error && topology?.nodes?.length > 0 && (
        <div className="mb-6 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Geographic Network View</h3>
              <p className="text-xs text-gray-500">Live feeder → transformer → meter locations with health overlay</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-500" /> Feeder</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-500" /> Transformer</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-500" /> Meter</span>
            </div>
          </div>
          <LeafletMap topology={topology} selectedNode={selectedNode} onSelectNode={setSelectedNode} />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* Graph area */}
        <div className="card p-0 overflow-hidden">
          {/* Search bar */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search nodes by name or ID..."
              className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
            />
            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS.healthy }} />
                Healthy
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS.warning }} />
                Warning
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS.critical }} />
                Critical
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-96 text-center px-6">
              <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
              <p className="text-gray-600 font-medium mb-1">Network Unavailable</p>
              <p className="text-sm text-gray-400">{error}</p>
              <button onClick={loadData} className="mt-4 btn-secondary text-sm">Retry</button>
            </div>
          ) : (
            <div className="overflow-auto" style={{ maxHeight: '600px' }}>
              <svg
                ref={svgRef}
                width={svgWidth}
                height={svgHeight}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="select-none"
              >
                {/* Edges */}
                {topology?.edges?.map((edge, i) => {
                  const from = positions[edge.source];
                  const to = positions[edge.target];
                  if (!from || !to) return null;
                  const targetNode = topology.nodes.find(n => n.id === edge.target);
                  const edgeColor = targetNode ? healthColor(targetNode.health_score) : '#d1d5db';
                  return (
                    <line
                      key={i}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={edgeColor}
                      strokeWidth={1.5}
                      opacity={search && (!highlightedIds.has(edge.source) && !highlightedIds.has(edge.target)) ? 0.15 : 0.4}
                    />
                  );
                })}
                {/* Nodes */}
                {topology?.nodes?.map(node => {
                  const pos = positions[node.id];
                  if (!pos) return null;
                  const dimmed = search && !highlightedIds.has(node.id);
                  return (
                    <g key={node.id} opacity={dimmed ? 0.2 : 1}>
                      <GraphNode
                        node={node}
                        pos={pos}
                        selected={selectedNode?.id === node.id}
                        onClick={setSelectedNode}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div>
          {selectedNode ? (
            <DetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
              <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">Select a node</p>
              <p className="text-xs text-gray-400 mt-1">Click any feeder, transformer, or meter on the graph to view its details.</p>
            </div>
          )}

          {/* Health summary from backend */}
          {healthData.length > 0 && (
            <div className="mt-4 bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Infrastructure Health</h3>
              <div className="space-y-2">
                {healthData.map(item => {
                  const color = healthColor(item.health_score);
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        const node = topology?.nodes?.find(n => n.id === item.id);
                        if (node) setSelectedNode(node);
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors text-left"
                    >
                      <div>
                        <p className="text-xs font-medium text-gray-900">{item.name}</p>
                        <p className="text-[10px] text-gray-500 capitalize">{item.type} &middot; {item.meter_count} meters</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${item.health_score * 100}%`, backgroundColor: color }} />
                        </div>
                        <span className="text-xs font-semibold" style={{ color }}>{Math.round(item.health_score * 100)}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

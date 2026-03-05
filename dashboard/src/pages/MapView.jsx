import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { Layers, Filter } from 'lucide-react';
import { PageHeader } from '../App';
import { metersAPI } from '../services/api';
import { getStatusColor, getHealthScoreLabel, formatRelativeDate } from '../utils/helpers';

const STATUS_COLORS = {
  healthy: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
};

const DEFAULT_CENTER = [29.4241, -98.4936]; // San Antonio
const DEFAULT_ZOOM = 12;

function Legend() {
  return (
    <div className="absolute bottom-4 left-4 z-[1000] bg-navy-800/90 backdrop-blur-sm border border-navy-600/50 rounded-lg p-3">
      <p className="text-xs font-semibold text-gray-300 mb-2">Meter Status</p>
      {Object.entries(STATUS_COLORS).map(([status, color]) => (
        <div key={status} className="flex items-center gap-2 mb-1 last:mb-0">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-xs text-gray-400 capitalize">{status}</span>
        </div>
      ))}
    </div>
  );
}

function FitBounds({ meters }) {
  const map = useMap();
  useEffect(() => {
    const points = meters
      .filter((m) => m.location_lat && m.location_lng)
      .map((m) => [m.location_lat, m.location_lng]);
    if (points.length > 1) {
      map.fitBounds(points, { padding: [40, 40] });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
  }, [meters, map]);
  return null;
}

export default function MapView() {
  const [meters, setMeters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await metersAPI.list();
        setMeters(res.data.meters || []);
      } catch (err) {
        console.error('Failed to load meters:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredMeters = useMemo(() => {
    const withCoords = meters.filter((m) => m.location_lat && m.location_lng);
    if (!statusFilter) return withCoords;
    return withCoords.filter((m) => m.status === statusFilter);
  }, [meters, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts = { healthy: 0, warning: 0, critical: 0 };
    meters.forEach((m) => {
      if (m.location_lat && m.location_lng && counts[m.status] !== undefined) {
        counts[m.status]++;
      }
    });
    return counts;
  }, [meters]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Map View" subtitle={`${filteredMeters.length} meters on map`}>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field w-36"
          >
            <option value="">All Status</option>
            <option value="healthy">Healthy ({statusCounts.healthy})</option>
            <option value="warning">Warning ({statusCounts.warning})</option>
            <option value="critical">Critical ({statusCounts.critical})</option>
          </select>
        </div>
      </PageHeader>

      <div className="card overflow-hidden relative" style={{ height: 'calc(100vh - 180px)' }}>
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          className="h-full w-full"
          style={{ background: '#131b3a' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <FitBounds meters={filteredMeters} />
          {filteredMeters.map((meter) => (
            <CircleMarker
              key={meter.id}
              center={[meter.location_lat, meter.location_lng]}
              radius={meter.status === 'critical' ? 10 : meter.status === 'warning' ? 8 : 6}
              pathOptions={{
                color: STATUS_COLORS[meter.status] || '#94a3b8',
                fillColor: STATUS_COLORS[meter.status] || '#94a3b8',
                fillOpacity: 0.7,
                weight: 2,
              }}
            >
              <Popup className="custom-popup">
                <div className="min-w-[200px]">
                  <div className="font-semibold text-sm mb-1">{meter.name}</div>
                  <div className="text-xs text-gray-500 font-mono mb-2">{meter.id}</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status:</span>
                      <span className={`font-medium capitalize ${getStatusColor(meter.status)}`}>{meter.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Health:</span>
                      <span className="font-medium">{Math.round(meter.health_score * 100)}% ({getHealthScoreLabel(Math.round(meter.health_score * 100))})</span>
                    </div>
                    {meter.suspected_issue && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Issue:</span>
                        <span className="font-medium text-amber-600">{meter.suspected_issue}</span>
                      </div>
                    )}
                    {meter.last_seen && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Last seen:</span>
                        <span>{formatRelativeDate(meter.last_seen)}</span>
                      </div>
                    )}
                  </div>
                  <Link
                    to={`/meters/${meter.id}`}
                    className="block mt-2 text-center text-xs font-medium text-blue-600 hover:text-blue-500"
                  >
                    View Details →
                  </Link>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
        <Legend />
      </div>
    </>
  );
}

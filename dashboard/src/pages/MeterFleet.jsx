import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, Filter, Gauge, Activity, ArrowUpRight,
  AlertTriangle, Zap, ChevronRight,
} from 'lucide-react';
import { PageHeader } from '../App';
import { metersAPI } from '../services/api';
import {
  formatDate, getStatusColor, getStatusBgColor,
  getHealthScoreLabel, getHealthScoreColor, formatRelativeDate,
} from '../utils/helpers';

const STATUS_FILTERS = [
  { value: '', label: 'All Meters' },
  { value: 'healthy', label: 'Healthy' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

function HealthBar({ score }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 85 ? 'bg-emerald-500' :
    pct >= 70 ? 'bg-blue-500' :
    pct >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2 w-32">
      <div className="flex-1 h-1.5 bg-navy-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-medium tabular-nums ${getHealthScoreColor(pct)}`}>{pct}%</span>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBgColor(status)}`}>
      {status === 'critical' && <Zap className="w-3 h-3" />}
      {status === 'warning' && <AlertTriangle className="w-3 h-3" />}
      {status}
    </span>
  );
}

export default function MeterFleet() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [meters, setMeters] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await metersAPI.list(statusFilter || undefined);
        setMeters(res.data.meters || []);
        setTotal(res.data.total || 0);
      } catch (err) {
        console.error('Failed to load meters:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [statusFilter]);

  const filteredMeters = meters.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.id.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      (m.suspected_issue && m.suspected_issue.toLowerCase().includes(q))
    );
  });

  const handleFilterChange = (value) => {
    setStatusFilter(value);
    if (value) {
      setSearchParams({ status: value });
    } else {
      setSearchParams({});
    }
  };

  return (
    <>
      <PageHeader
        title="Meter Fleet"
        subtitle={`${total} meters monitored`}
      />

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search meters by ID, name, or issue..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <div className="flex rounded-lg overflow-hidden border border-navy-600">
            {STATUS_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleFilterChange(value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === value
                    ? 'bg-blue-600 text-white'
                    : 'bg-navy-800 text-gray-400 hover:text-gray-200 hover:bg-navy-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Meter Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-700/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Meter</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Health Score</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Suspected Issue</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Seen</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredMeters.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-500">
                      No meters found
                    </td>
                  </tr>
                ) : (
                  filteredMeters.map((meter) => (
                    <tr
                      key={meter.id}
                      className="border-b border-navy-800/50 hover:bg-navy-800/30 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div>
                          <Link
                            to={`/meters/${meter.id}`}
                            className="text-sm font-medium text-gray-200 hover:text-blue-400 transition-colors"
                          >
                            {meter.name}
                          </Link>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">{meter.id}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={meter.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <HealthBar score={meter.health_score} />
                      </td>
                      <td className="px-5 py-3.5">
                        {meter.suspected_issue ? (
                          <span className="text-sm text-amber-400">{meter.suspected_issue}</span>
                        ) : (
                          <span className="text-sm text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-gray-400">
                          {meter.last_seen ? formatRelativeDate(meter.last_seen) : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Link
                          to={`/meters/${meter.id}`}
                          className="p-1.5 rounded-lg hover:bg-navy-700 transition-colors text-gray-500 hover:text-gray-300"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

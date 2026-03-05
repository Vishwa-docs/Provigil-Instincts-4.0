import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList, Plus, Filter, Clock, CheckCircle,
  AlertTriangle, Wrench, Calendar, RefreshCw, ChevronDown,
} from 'lucide-react';
import { PageHeader } from '../App';
import { workOrdersAPI } from '../services/api';
import {
  formatDate, formatRelativeDate, getStatusBgColor,
} from '../utils/helpers';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const PRIORITY_LABELS = {
  1: { label: 'P1 - Critical', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/20' },
  2: { label: 'P2 - High', color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/20' },
  3: { label: 'P3 - Medium', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/20' },
  4: { label: 'P4 - Low', color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/20' },
  5: { label: 'P5 - Info', color: 'text-gray-400', bg: 'bg-gray-500/15 border-gray-500/20' },
};

function StatusIcon({ status }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    case 'in_progress':
      return <Wrench className="w-4 h-4 text-blue-400" />;
    case 'scheduled':
      return <Calendar className="w-4 h-4 text-cyan-400" />;
    default:
      return <Clock className="w-4 h-4 text-amber-400" />;
  }
}

export default function WorkOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState('all'); // 'all' or 'prioritized'
  const [updatingId, setUpdatingId] = useState(null);

  async function loadOrders() {
    setLoading(true);
    try {
      let res;
      if (viewMode === 'prioritized') {
        res = await workOrdersAPI.getPrioritized();
      } else {
        res = await workOrdersAPI.list(statusFilter || undefined);
      }
      setOrders(res.data || []);
    } catch (err) {
      console.error('Failed to load work orders:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, [statusFilter, viewMode]);

  async function handleStatusUpdate(orderId, newStatus) {
    setUpdatingId(orderId);
    try {
      await workOrdersAPI.update(orderId, { status: newStatus });
      setOrders((prev) =>
        prev.map((wo) =>
          wo.id === orderId ? { ...wo, status: newStatus } : wo
        )
      );
    } catch (err) {
      console.error('Failed to update work order:', err);
    } finally {
      setUpdatingId(null);
    }
  }

  const statusCounts = orders.reduce((acc, wo) => {
    acc[wo.status] = (acc[wo.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Work Orders"
        subtitle={`${orders.length} work orders`}
      >
        <button onClick={loadOrders} className="btn-secondary" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </PageHeader>

      {/* View Mode Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <div className="flex rounded-lg overflow-hidden border border-navy-600">
          <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-navy-800 text-gray-400 hover:text-gray-200 hover:bg-navy-700'
            }`}
          >
            All Orders
          </button>
          <button
            onClick={() => setViewMode('prioritized')}
            className={`px-4 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'prioritized'
                ? 'bg-blue-600 text-white'
                : 'bg-navy-800 text-gray-400 hover:text-gray-200 hover:bg-navy-700'
            }`}
          >
            Prioritized Queue
          </button>
        </div>

        {viewMode === 'all' && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <div className="flex rounded-lg overflow-hidden border border-navy-600">
              {STATUS_FILTERS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value)}
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
        )}
      </div>

      {/* Work Order List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="card p-12 text-center">
          <ClipboardList className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No work orders found</p>
          <p className="text-sm text-gray-600 mt-1">Work orders are created automatically when anomalies are detected</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-700/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">ID</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Meter</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Priority</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Issue Type</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Scheduled</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Created</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((wo) => {
                  const prio = PRIORITY_LABELS[wo.priority] || PRIORITY_LABELS[3];
                  return (
                    <tr
                      key={wo.id}
                      className="border-b border-navy-800/50 hover:bg-navy-800/30 transition-colors"
                    >
                      <td className="px-5 py-3.5 text-sm font-mono text-gray-300">#{wo.id}</td>
                      <td className="px-5 py-3.5">
                        <Link
                          to={`/meters/${wo.meter_id}`}
                          className="text-sm text-blue-400 hover:text-blue-300 font-mono"
                        >
                          {wo.meter_id}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${prio.bg}`}>
                          {prio.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-300">{wo.issue_type}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBgColor(wo.status)}`}>
                          <StatusIcon status={wo.status} />
                          {wo.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-400">
                        {wo.scheduled_date ? formatDate(wo.scheduled_date, 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-500" title={formatDate(wo.created_at)}>
                        {formatRelativeDate(wo.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        {wo.status !== 'completed' && (
                          <div className="relative group">
                            <button
                              className="btn-secondary text-xs"
                              disabled={updatingId === wo.id}
                            >
                              {updatingId === wo.id ? (
                                <div className="w-3.5 h-3.5 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  Update
                                  <ChevronDown className="w-3 h-3" />
                                </>
                              )}
                            </button>
                            <div className="absolute right-0 top-full mt-1 w-36 bg-navy-800 border border-navy-600 rounded-lg shadow-xl z-10 py-1 hidden group-hover:block">
                              {wo.status !== 'scheduled' && (
                                <button
                                  onClick={() => handleStatusUpdate(wo.id, 'scheduled')}
                                  className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-navy-700 transition-colors"
                                >
                                  Schedule
                                </button>
                              )}
                              {wo.status !== 'in_progress' && (
                                <button
                                  onClick={() => handleStatusUpdate(wo.id, 'in_progress')}
                                  className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-navy-700 transition-colors"
                                >
                                  Start Work
                                </button>
                              )}
                              <button
                                onClick={() => handleStatusUpdate(wo.id, 'completed')}
                                className="w-full text-left px-3 py-1.5 text-xs text-emerald-400 hover:bg-navy-700 transition-colors"
                              >
                                Mark Complete
                              </button>
                            </div>
                          </div>
                        )}
                        {wo.status === 'completed' && (
                          <span className="flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Done
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

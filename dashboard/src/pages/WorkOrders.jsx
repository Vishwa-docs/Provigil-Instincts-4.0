import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
 ClipboardList, Filter, Clock, CheckCircle,
 AlertTriangle, Wrench, Calendar, RefreshCw, ChevronDown,
 Sparkles, MoreVertical,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { workOrdersAPI, aiAPI } from '../services/api';
import {
 formatDate, formatRelativeDate, getStatusBgColor, formatIssueLabel,
} from '../utils/helpers';

const STATUS_FILTERS = [
 { value: '', label: 'All' },
 { value: 'pending', label: 'Pending' },
 { value: 'scheduled', label: 'Scheduled' },
 { value: 'in_progress', label: 'In Progress' },
 { value: 'completed', label: 'Completed' },
];

const PRIORITY_LABELS = {
 1: { label: 'P1 - Critical', color: 'text-gray-900', bg: 'bg-red-50 border-red-200' },
 2: { label: 'P2 - High', color: 'text-gray-900', bg: 'bg-orange-500/15 border-orange-500/20' },
 3: { label: 'P3 - Medium', color: 'text-gray-900', bg: 'bg-orange-50 border-orange-200' },
 4: { label: 'P4 - Low', color: 'text-gray-900', bg: 'bg-blue-50 border-blue-200' },
 5: { label: 'P5 - Info', color: 'text-gray-900', bg: 'bg-gray-500/15 border-gray-500/20' },
};

function StatusIcon({ status }) {
 switch (status) {
 case 'completed':
 return <CheckCircle className="w-4 h-4 text-green-600"/>;
 case 'in_progress':
 return <Wrench className="w-4 h-4 text-[#0071E3]"/>;
 case 'scheduled':
 return <Calendar className="w-4 h-4 text-[#5AC8FA]"/>;
 default:
 return <Clock className="w-4 h-4 text-orange-500"/>;
 }
}

function WorkOrderCard({ wo, prio, updatingId, onStatusUpdate }) {
 const [menuOpen, setMenuOpen] = useState(false);
 const menuRef = useRef(null);

 useEffect(() => {
 function handleClickOutside(e) {
 if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
 }
 if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
 return () => document.removeEventListener('mousedown', handleClickOutside);
 }, [menuOpen]);

 const statusSteps = ['pending', 'scheduled', 'in_progress', 'completed'];
 const currentIdx = statusSteps.indexOf(wo.status);

 return (
 <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all duration-200 border-l-4 ${
 wo.priority === 1 ? 'border-l-red-500' : wo.priority === 2 ? 'border-l-orange-400' : wo.priority === 3 ? 'border-l-yellow-400' : 'border-l-blue-400'
 }`}>
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-3 mb-2 flex-wrap">
 <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${prio.bg} ${prio.color}`}>
 {prio.label}
 </span>
 <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBgColor(wo.status)}`}>
 <StatusIcon status={wo.status} />{wo.status.replace('_', ' ')}
 </span>
 <span className="text-xs text-gray-400 font-mono">#{wo.id}</span>
 </div>
 <p className="text-sm font-medium text-gray-900 mb-1">{wo.issue_type ? formatIssueLabel(wo.issue_type) : 'Maintenance Required'}</p>
 {wo.description && <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-2">{wo.description}</p>}
 <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
 <Link to={`/meters/${wo.meter_id}`} className="text-[#0071E3] hover:text-blue-600 font-mono">{wo.meter_id}</Link>
 {wo.scheduled_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(wo.scheduled_date, 'MMM d, yyyy')}</span>}
 <span title={formatDate(wo.created_at)}>{formatRelativeDate(wo.created_at)}</span>
 </div>
 </div>

 <div className="shrink-0 relative" ref={menuRef}>
 {wo.status === 'completed' ? (
 <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
 <CheckCircle className="w-3.5 h-3.5"/> Completed
 </span>
 ) : (
 <>
 <button
 onClick={() => setMenuOpen(!menuOpen)}
 disabled={updatingId === wo.id}
 className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
 >
 {updatingId === wo.id ? (
 <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/>
 ) : (
 <MoreVertical className="w-4 h-4" />
 )}
 </button>
 {menuOpen && (
 <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
 {wo.status !== 'scheduled' && (
 <button onClick={() => { onStatusUpdate(wo.id, 'scheduled'); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
 <Calendar className="w-3.5 h-3.5 text-cyan-500"/>Schedule
 </button>
 )}
 {wo.status !== 'in_progress' && (
 <button onClick={() => { onStatusUpdate(wo.id, 'in_progress'); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
 <Wrench className="w-3.5 h-3.5 text-blue-500"/>Start Work
 </button>
 )}
 <button onClick={() => { onStatusUpdate(wo.id, 'completed'); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-green-700 hover:bg-green-50 transition-colors flex items-center gap-2">
 <CheckCircle className="w-3.5 h-3.5"/>Mark Complete
 </button>
 </div>
 )}
 </>
 )}
 </div>
 </div>

 {/* Status timeline */}
 <div className="mt-4 flex items-center gap-1">
 {statusSteps.map((step, i) => (
 <div key={step} className="flex items-center flex-1">
 <div className={`h-1 flex-1 rounded-full ${i <= currentIdx ? (wo.status === 'completed' ? 'bg-green-400' : 'bg-[#0071E3]') : 'bg-gray-100'}`} />
 </div>
 ))}
 </div>
 </div>
 );
}

export default function WorkOrders() {
 const [orders, setOrders] = useState([]);
 const [loading, setLoading] = useState(true);
 const [statusFilter, setStatusFilter] = useState('');
 const [viewMode, setViewMode] = useState('all'); // 'all' or 'prioritized'
 const [updatingId, setUpdatingId] = useState(null);  async function loadOrders() {
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
 }  useEffect(() => {
 loadOrders();
 }, [statusFilter, viewMode]);  async function handleStatusUpdate(orderId, newStatus) {
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
 }  const statusCounts = orders.reduce((acc, wo) => {
 acc[wo.status] = (acc[wo.status] || 0) + 1;
 return acc;
 }, {});  return (
 <div data-tour="workorders-page">
 <PageHeader
 title="Work Orders"
 subtitle={`${orders.length} work orders`}
 >
 <button onClick={loadOrders} className="btn-secondary"disabled={loading}>
 <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
 Refresh
 </button>
 </PageHeader>  {/* View Mode Toggle */}
 <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
 <div className="flex rounded-lg overflow-hidden border border-gray-200">
 <button
 onClick={() => setViewMode('all')}
 className={`px-4 py-1.5 text-xs font-medium transition-colors ${
 viewMode === 'all'
 ? 'bg-[#0071E3] text-white'
 : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50'
 }`}
 >
 All Orders
 </button>
 <button
 onClick={() => setViewMode('prioritized')}
 className={`px-4 py-1.5 text-xs font-medium transition-colors ${
 viewMode === 'prioritized'
 ? 'bg-[#0071E3] text-white'
 : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50'
 }`}
 >
 Prioritized Queue
 </button>
 </div>  {viewMode === 'all' && (
 <div className="flex items-center gap-2">
 <Filter className="w-4 h-4 text-gray-500"/>
 <div className="flex rounded-lg overflow-hidden border border-gray-200">
 {STATUS_FILTERS.map(({ value, label }) => (
 <button
 key={value}
 onClick={() => setStatusFilter(value)}
 className={`px-3 py-1.5 text-xs font-medium transition-colors ${
 statusFilter === value
 ? 'bg-[#0071E3] text-white'
 : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50'
 }`}
 >
 {label}
 </button>
 ))}
 </div>
 </div>
 )}
 </div>  {/* Work Order List */}
 {loading ? (
 <div className="flex items-center justify-center h-64">
 <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
 </div>
 ) : orders.length === 0 ? (
 <div className="card p-12 text-center">
 <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3"/>
 <p className="text-gray-500 font-medium">No work orders found</p>
 <p className="text-sm text-gray-400 mt-1">Work orders are created automatically when the ML models detect anomalies, or via the Live Fault Detection button on the dashboard.</p>
 </div>
 ) : (
 <div className="space-y-3">
 {orders.map((wo) => {
 const prio = PRIORITY_LABELS[wo.priority] || PRIORITY_LABELS[3];
 return (
 <WorkOrderCard
 key={wo.id}
 wo={wo}
 prio={prio}
 updatingId={updatingId}
 onStatusUpdate={handleStatusUpdate}
 />
 );
 })}
 </div>
 )}
 </div>
 );
}

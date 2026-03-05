import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart,
} from 'recharts';
import {
  Gauge, AlertTriangle, Activity, TrendingUp, Zap,
  ArrowUpRight, ArrowDownRight, Shield, Clock,
} from 'lucide-react';
import { PageHeader } from '../App';
import { dashboardAPI } from '../services/api';
import {
  formatDate, formatRelativeDate, getStatusColor, getSeverityBgColor,
  formatNumber, getHealthScoreLabel, getHealthScoreColor,
} from '../utils/helpers';

const COLORS = {
  healthy: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
};

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444'];

function StatCard({ title, value, subtitle, icon: Icon, color, trend, trendValue }) {
  const colorMap = {
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/20',
    green: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20',
    amber: 'from-amber-500/20 to-amber-600/5 border-amber-500/20',
    red: 'from-red-500/20 to-red-600/5 border-red-500/20',
    cyan: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/20',
  };
  const iconColorMap = {
    blue: 'text-blue-400',
    green: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    cyan: 'text-cyan-400',
  };

  return (
    <div className={`stat-card bg-gradient-to-br ${colorMap[color]} border`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg bg-navy-900/50`}>
          <Icon className={`w-5 h-5 ${iconColorMap[color]}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${
            trend === 'up' ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {trend === 'up' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {trendValue}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      <p className="text-xs text-gray-400">{title}</p>
      {subtitle && <p className="text-[10px] text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [healthDist, setHealthDist] = useState([]);
  const [anomalyTrend, setAnomalyTrend] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, healthRes, trendRes, alertsRes] = await Promise.all([
          dashboardAPI.getStats(),
          dashboardAPI.getHealthDistribution(),
          dashboardAPI.getAnomalyTrend(),
          dashboardAPI.getRecentAlerts(),
        ]);
        setStats(statsRes.data);
        setHealthDist(healthRes.data.buckets || []);
        setAnomalyTrend(trendRes.data.days || []);
        setRecentAlerts(alertsRes.data || []);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const pieData = stats ? [
    { name: 'Healthy', value: stats.healthy },
    { name: 'Warning', value: stats.warning },
    { name: 'Critical', value: stats.critical },
  ] : [];

  const healthPercent = stats ? Math.round(stats.avg_health_score * 100) : 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Real-time predictive maintenance overview"
      >
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span>Auto-refresh: 30s</span>
        </div>
      </PageHeader>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
        <StatCard
          title="Total Meters"
          value={formatNumber(stats?.total_meters)}
          icon={Gauge}
          color="blue"
          subtitle="Connected devices"
        />
        <StatCard
          title="Healthy"
          value={formatNumber(stats?.healthy)}
          icon={Shield}
          color="green"
          subtitle={`${stats?.total_meters ? Math.round((stats.healthy / stats.total_meters) * 100) : 0}% of fleet`}
        />
        <StatCard
          title="Warning"
          value={formatNumber(stats?.warning)}
          icon={AlertTriangle}
          color="amber"
          subtitle="Needs attention"
        />
        <StatCard
          title="Critical"
          value={formatNumber(stats?.critical)}
          icon={Zap}
          color="red"
          subtitle="Immediate action"
        />
        <StatCard
          title="Avg Health Score"
          value={`${healthPercent}%`}
          icon={Activity}
          color="cyan"
          subtitle={getHealthScoreLabel(healthPercent)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Fleet Health Distribution */}
        <div className="lg:col-span-2 card p-5">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Fleet Health Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={healthDist} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#28355d" strokeOpacity={0.5} />
                <XAxis
                  dataKey="range"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={{ stroke: '#28355d' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="count"
                  name="Meters"
                  radius={[4, 4, 0, 0]}
                  fill="#3b82f6"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Meter Status Breakdown */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Meter Status</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {pieData.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                  <span className="text-gray-300">{item.name}</span>
                </div>
                <span className="font-medium text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Anomaly Trend */}
        <div className="lg:col-span-2 card p-5">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Anomaly Trend (30 Days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={anomalyTrend}>
                <defs>
                  <linearGradient id="anomalyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#28355d" strokeOpacity={0.5} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={{ stroke: '#28355d' }}
                  tickLine={false}
                  tickFormatter={(v) => v ? v.slice(5) : ''}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Anomalies"
                  stroke="#ef4444"
                  fill="url(#anomalyGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-200">Recent Alerts</h3>
            <Link to="/alerts" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              View all →
            </Link>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {recentAlerts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No recent alerts</p>
            ) : (
              recentAlerts.slice(0, 8).map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-navy-900/40 border border-navy-700/30"
                >
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                    alert.severity === 'critical' ? 'bg-red-400 animate-pulse-critical' :
                    alert.severity === 'warning' ? 'bg-amber-400' : 'bg-blue-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getSeverityBgColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {formatRelativeDate(alert.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

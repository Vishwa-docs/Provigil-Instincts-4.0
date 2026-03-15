import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart,
} from 'recharts';
import {
  Gauge, AlertTriangle, Activity, Zap,
  ArrowUpRight, ArrowDownRight, Shield, Clock,
  TrendingDown, MapPin, Box, Network,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { dashboardAPI, networkAPI } from '../services/api';
import {
  formatRelativeDate, getSeverityBgColor,
  formatNumber, getHealthScoreLabel,
} from '../utils/helpers';

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444'];

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4 } }),
};

function GlassCard({ children, className = '', index = 0 }) {
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className={`relative rounded-2xl border border-white/[0.06] bg-gradient-to-br from-navy-800/60 to-navy-900/80 backdrop-blur-xl shadow-xl shadow-black/20 overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
      <div className="relative">{children}</div>
    </motion.div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color, trend, trendValue, index = 0 }) {
  const glow = {
    blue: 'shadow-blue-500/10',
    green: 'shadow-emerald-500/10',
    amber: 'shadow-amber-500/10',
    red: 'shadow-red-500/10',
    cyan: 'shadow-cyan-500/10',
    purple: 'shadow-purple-500/10',
  };
  const iconBg = {
    blue: 'from-blue-500/20 to-blue-600/5',
    green: 'from-emerald-500/20 to-emerald-600/5',
    amber: 'from-amber-500/20 to-amber-600/5',
    red: 'from-red-500/20 to-red-600/5',
    cyan: 'from-cyan-500/20 to-cyan-600/5',
    purple: 'from-purple-500/20 to-purple-600/5',
  };
  const iconColor = {
    blue: 'text-blue-400', green: 'text-emerald-400', amber: 'text-amber-400',
    red: 'text-red-400', cyan: 'text-cyan-400', purple: 'text-purple-400',
  };

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className={`relative rounded-2xl border border-white/[0.06] bg-gradient-to-br from-navy-800/60 to-navy-900/80 backdrop-blur-xl p-4 shadow-lg ${glow[color]}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${iconBg[color]}`}>
          <Icon className={`w-5 h-5 ${iconColor[color]}`} />
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
    </motion.div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-navy-800/95 backdrop-blur border border-navy-600 rounded-xl px-3 py-2 shadow-xl">
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
  const [networkHealth, setNetworkHealth] = useState(null);
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

        // Non-critical: load in background
        networkAPI.getHealth().then(r => setNetworkHealth(r.data)).catch(() => {});
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
  const criticals = stats?.critical || 0;
  const feederCount = networkHealth?.filter((node) => node.type === 'feeder').length || 0;
  const transformerCount = networkHealth?.filter((node) => node.type === 'transformer').length || 0;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Real-time predictive maintenance overview">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span>Auto-refresh: 30s</span>
        </div>
      </PageHeader>

      {/* Critical Alert Banner */}
      {criticals > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-red-500/30 bg-gradient-to-r from-red-500/10 via-red-900/10 to-navy-900/50 p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-500/20 animate-pulse">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-300">{criticals} Critical Meter{criticals > 1 ? 's' : ''} Detected</p>
              <p className="text-xs text-red-400/70">Immediate field inspection recommended</p>
            </div>
          </div>
          <Link to="/alerts?severity=critical" className="text-xs font-medium text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/10 transition-colors">
            View Alerts →
          </Link>
        </motion.div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard title="Total Meters" value={formatNumber(stats?.total_meters)} icon={Gauge} color="blue" subtitle="Connected devices" index={0} />
        <StatCard title="Healthy" value={formatNumber(stats?.healthy)} icon={Shield} color="green" subtitle={`${stats?.total_meters ? Math.round((stats.healthy / stats.total_meters) * 100) : 0}% of fleet`} index={1} />
        <StatCard title="Warning" value={formatNumber(stats?.warning)} icon={AlertTriangle} color="amber" subtitle="Needs attention" index={2} />
        <StatCard title="Critical" value={formatNumber(stats?.critical)} icon={Zap} color="red" subtitle="Immediate action" index={3} />
        <StatCard title="Avg Health" value={`${healthPercent}%`} icon={Activity} color="cyan" subtitle={getHealthScoreLabel(healthPercent)} index={4} />
        <StatCard
          title="Grid Zones"
          value={formatNumber(feederCount + transformerCount)}
          icon={Network}
          color="purple"
          subtitle={`${feederCount} feeders • ${transformerCount} transformers`}
          index={5}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <GlassCard className="p-4" index={5.1}>
          <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Innovation 01</p>
          <p className="text-sm font-semibold text-white">Localized fleet intelligence</p>
          <p className="text-xs text-gray-400 mt-1">Each meter is scored in feeder and transformer context, not as an isolated device.</p>
        </GlassCard>
        <GlassCard className="p-4" index={5.2}>
          <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Innovation 02</p>
          <p className="text-sm font-semibold text-white">Network consensus</p>
          <p className="text-xs text-gray-400 mt-1">Neighbor meters help separate local hardware faults from upstream grid problems.</p>
        </GlassCard>
        <GlassCard className="p-4" index={5.3}>
          <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Innovation 03</p>
          <p className="text-sm font-semibold text-white">Digital twin diagnostics</p>
          <p className="text-xs text-gray-400 mt-1">Terminal, relay, battery, PSU, display, and communication health are tracked component by component.</p>
        </GlassCard>
        <GlassCard className="p-4" index={5.4}>
          <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Innovation 04</p>
          <p className="text-sm font-semibold text-white">Field vision workflow</p>
          <p className="text-xs text-gray-400 mt-1">A VLM-assisted workflow is ready to validate loose connections from field photos and videos.</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Fleet Health Distribution */}
        <GlassCard className="lg:col-span-2 p-5" index={6}>
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Fleet Health Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={healthDist} barSize={32}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#28355d" strokeOpacity={0.5} />
                <XAxis dataKey="range" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#28355d' }} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Meters" radius={[6, 6, 0, 0]} fill="url(#barGrad)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Meter Status Breakdown */}
        <GlassCard className="p-5" index={7}>
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Fleet Status</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none">
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
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Anomaly Trend */}
        <GlassCard className="lg:col-span-2 p-5" index={8}>
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
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#28355d' }} tickLine={false} tickFormatter={(v) => v ? v.slice(5) : ''} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="total" name="Anomalies" stroke="#ef4444" fill="url(#anomalyGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Recent Alerts */}
        <GlassCard className="p-5" index={9}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-200">Recent Alerts</h3>
            <Link to="/alerts" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">View all →</Link>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {recentAlerts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No recent alerts</p>
            ) : (
              recentAlerts.slice(0, 8).map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 p-3 rounded-xl bg-navy-900/40 border border-navy-700/30 hover:bg-navy-800/40 transition-colors">
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                    alert.severity === 'critical' ? 'bg-red-400 animate-pulse' : alert.severity === 'warning' ? 'bg-amber-400' : 'bg-blue-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getSeverityBgColor(alert.severity)}`}>{alert.severity}</span>
                      <span className="text-[10px] text-gray-500">{formatRelativeDate(alert.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/map">
          <GlassCard className="p-5 hover:border-blue-500/30 transition-all cursor-pointer group" index={10}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                <MapPin className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-200">Network Map</p>
                <p className="text-xs text-gray-500">View meter topology & grid health</p>
              </div>
            </div>
          </GlassCard>
        </Link>
        <Link to="/digital-twin">
          <GlassCard className="p-5 hover:border-cyan-500/30 transition-all cursor-pointer group" index={11}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
                <Box className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-200">Digital Twin</p>
                <p className="text-xs text-gray-500">Component-level meter visualization</p>
              </div>
            </div>
          </GlassCard>
        </Link>
        <Link to="/workorders">
          <GlassCard className="p-5 hover:border-amber-500/30 transition-all cursor-pointer group" index={12}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
                <TrendingDown className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-200">Work Orders</p>
                <p className="text-xs text-gray-500">AI-prioritized maintenance queue</p>
              </div>
            </div>
          </GlassCard>
        </Link>
      </div>
    </>
  );
}

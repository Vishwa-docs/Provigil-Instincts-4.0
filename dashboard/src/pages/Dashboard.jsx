import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart,
} from 'recharts';
import {
  Gauge, AlertTriangle, Activity, Zap,
  Shield, Clock, Thermometer, Battery,
  TrendingDown, Wifi, BookOpen,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import ScenarioTrigger from '../components/ScenarioTrigger';
import EmailSubscribe from '../components/EmailSubscribe';
import EmailToggle from '../components/EmailToggle';
import { dashboardAPI, metersAPI } from '../services/api';
import {
  formatRelativeDate, getSeverityBgColor,
  formatNumber, getHealthScoreLabel, formatIssueLabel,
  getHealthScoreColor,
} from '../utils/helpers';

const PIE_COLORS = ['#34C759', '#FF9500', '#FF3B30'];

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.35 } }),
};

function StatCard({ title, value, subtitle, icon: Icon, color, index = 0 }) {
  const colorMap = {
    blue: { border: 'border-l-blue-500', iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
    green: { border: 'border-l-green-500', iconBg: 'bg-green-50', iconColor: 'text-green-600' },
    orange: { border: 'border-l-orange-400', iconBg: 'bg-orange-50', iconColor: 'text-orange-500' },
    red: { border: 'border-l-red-500', iconBg: 'bg-red-50', iconColor: 'text-red-500' },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className={`bg-white rounded-2xl shadow-sm border border-gray-100 border-l-4 ${c.border} p-5 hover:shadow-md transition-shadow duration-200`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-xl ${c.iconBg}`}>
          <Icon className={`w-5 h-5 ${c.iconColor}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-xs text-gray-500 font-medium">{title}</p>
      {subtitle && <p className="text-[10px] text-gray-400 mt-1">{subtitle}</p>}
    </motion.div>
  );
}

function LightTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
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
  const [fleetRisks, setFleetRisks] = useState(null);
  const [decliningMeters, setDecliningMeters] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
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

      // Compute fleet risk insights from meter list
      try {
        const metersRes = await metersAPI.list();
        const meters = metersRes.data?.meters || [];
        const issues = meters.reduce((acc, m) => {
          const issue = (m.suspected_issue || '').toLowerCase();
          if (issue.includes('thermal') || issue.includes('terminal') || issue.includes('loose')) acc.thermal++;
          if (issue.includes('relay') || issue.includes('chatter')) acc.relay++;
          if (issue.includes('thd') || issue.includes('harmonic') || issue.includes('voltage')) acc.harmonic++;
          if (issue.includes('battery') || issue.includes('rtc')) acc.battery++;
          if (issue.includes('comm') || issue.includes('communication')) acc.comms++;
          return acc;
        }, { thermal: 0, relay: 0, harmonic: 0, battery: 0, comms: 0 });
        setFleetRisks(issues);

        // Compute predictive maintenance early warnings: meters with issues + low health
        const declining = meters
          .filter(m => m.suspected_issue && m.health_score < 0.85)
          .sort((a, b) => a.health_score - b.health_score)
          .slice(0, 5)
          .map(m => ({
            id: m.id,
            name: m.name,
            health: Math.round(m.health_score * 100),
            issue: m.suspected_issue,
            status: m.status,
          }));
        setDecliningMeters(declining);
      } catch {}
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin" />
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

  const criticals = stats?.critical || 0;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Real-time predictive maintenance overview">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span>Auto-refresh: 30s</span>
        </div>
      </PageHeader>

      {/* CTA Section: Fault Detection + Email Subscribe */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 bg-gradient-to-br from-white to-blue-50/50 rounded-2xl shadow-sm border border-gray-100 p-6"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Live Fault Detection</h2>
            <p className="text-sm text-gray-500 mb-4">
              Run the ML detection pipeline on a live meter and watch the full detection-to-resolution workflow — from anomaly scoring to AI analysis, work order generation, and email alerts.
            </p>
            <ScenarioTrigger onTriggered={loadData} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Get Critical Alert Notifications</h3>
              <EmailToggle />
            </div>
            <p className="text-xs text-gray-500 mb-3">Enter your email to receive real-time alerts when critical meter faults are detected. Try running a fault detection cycle after subscribing.</p>
            <EmailSubscribe />
          </div>
        </div>
      </motion.div>

      {/* Critical Alert Banner */}
      {criticals > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl bg-red-50 border border-red-200 p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-100">
              <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse-critical" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-700">{criticals} Critical Meter{criticals > 1 ? 's' : ''} Detected</p>
              <p className="text-xs text-red-500">Immediate field inspection recommended</p>
            </div>
          </div>
          <Link to="/alerts?severity=critical" className="text-xs font-medium text-red-600 hover:text-red-700 px-3 py-1.5 rounded-xl border border-red-200 hover:bg-red-100 transition-colors">
            View Alerts →
          </Link>
        </motion.div>
      )}

      {/* Stat Cards */}
      <div data-tour="stat-cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Meters" value={formatNumber(stats?.total_meters)} icon={Gauge} color="blue" subtitle="Connected devices" index={0} />
        <StatCard title="Healthy" value={formatNumber(stats?.healthy)} icon={Shield} color="green" subtitle={`${stats?.total_meters ? Math.round((stats.healthy / stats.total_meters) * 100) : 0}% of fleet`} index={1} />
        <StatCard title="Warning" value={formatNumber(stats?.warning)} icon={AlertTriangle} color="orange" subtitle="Needs attention" index={2} />
        <StatCard title="Critical" value={formatNumber(stats?.critical)} icon={Zap} color="red" subtitle="Immediate action" index={3} />
      </div>

      {/* Link to How It Works page */}
      <Link
        to="/"
        data-tour="how-it-works-link"
        className="mb-6 flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all duration-200 group"
      >
        <div className="p-2.5 rounded-xl bg-blue-50 group-hover:bg-blue-100 transition-colors">
          <BookOpen className="w-5 h-5 text-[#0071E3]" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">How Our AI Detects Faults</p>
          <p className="text-xs text-gray-500">6 ML detection methods &middot; 12 DISCOM problems solved &middot; Full detection parameters</p>
        </div>
        <span className="text-xs font-medium text-[#0071E3] group-hover:translate-x-1 transition-transform">Explore →</span>
      </Link>

      {/* Fleet Risk Insights */}
      {fleetRisks && (fleetRisks.thermal + fleetRisks.relay + fleetRisks.harmonic + fleetRisks.battery + fleetRisks.comms) > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
        >
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Fleet Risk Insights</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Terminal / Thermal', count: fleetRisks.thermal, icon: Thermometer, color: 'text-red-500', bg: 'bg-red-50' },
              { label: 'Relay Wear', count: fleetRisks.relay, icon: Zap, color: 'text-orange-500', bg: 'bg-orange-50' },
              { label: 'Harmonic / Voltage', count: fleetRisks.harmonic, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Battery / RTC', count: fleetRisks.battery, icon: Battery, color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Comms Degradation', count: fleetRisks.comms, icon: Wifi, color: 'text-purple-600', bg: 'bg-purple-50' },
            ].filter(r => r.count > 0).map(({ label, count, icon: RIcon, color, bg }) => (
              <div key={label} className={`flex items-center gap-3 p-3 rounded-xl ${bg} border border-gray-100`}>
                <RIcon className={`w-4 h-4 ${color} shrink-0`} />
                <div>
                  <p className="text-lg font-bold text-gray-900">{count}</p>
                  <p className="text-[10px] text-gray-500">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Predictive Maintenance — Early Warnings */}
      {decliningMeters.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-gray-700">Predictive Maintenance — Early Warnings</h3>
          </div>
          <p className="text-xs text-gray-400 mb-3">Meters with declining health identified by our ML models. Predicted to need maintenance before failure occurs.</p>
          <div className="space-y-2">
            {decliningMeters.map(m => (
              <Link key={m.id} to={`/meters/${m.id}`} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-white hover:border-gray-200 transition-all">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{m.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${m.status === 'critical' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>{m.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{formatIssueLabel(m.issue)}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-lg font-bold ${getHealthScoreColor(m.health)}`}>{m.health}%</span>
                  <p className="text-[10px] text-gray-400">health</p>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Charts */}
      <div data-tour="charts" className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Fleet Health Distribution */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Fleet Health Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={healthDist} barSize={32}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0071E3" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#0071E3" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" strokeOpacity={0.7} />
                <XAxis dataKey="range" tick={{ fill: '#86868B', fontSize: 11 }} axisLine={{ stroke: '#E5E5EA' }} tickLine={false} />
                <YAxis tick={{ fill: '#86868B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<LightTooltip />} />
                <Bar dataKey="count" name="Meters" radius={[6, 6, 0, 0]} fill="url(#barGrad)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fleet Status Pie */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Fleet Status</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip content={<LightTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {pieData.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                  <span className="text-gray-600">{item.name}</span>
                </div>
                <span className="font-medium text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Anomaly Trend */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Anomaly Trend (30 Days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={anomalyTrend}>
                <defs>
                  <linearGradient id="anomalyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF3B30" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#FF3B30" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" strokeOpacity={0.7} />
                <XAxis dataKey="date" tick={{ fill: '#86868B', fontSize: 11 }} axisLine={{ stroke: '#E5E5EA' }} tickLine={false} tickFormatter={(v) => v ? v.slice(5) : ''} />
                <YAxis tick={{ fill: '#86868B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<LightTooltip />} />
                <Area type="monotone" dataKey="total" name="Anomalies" stroke="#FF3B30" fill="url(#anomalyGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Recent Alerts</h3>
            <Link to="/alerts" className="text-xs text-[#0071E3] hover:underline transition-colors">View all →</Link>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {recentAlerts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No recent alerts</p>
            ) : (
              recentAlerts.slice(0, 8).map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors">
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                    alert.severity === 'critical' ? 'bg-red-500 animate-pulse' : alert.severity === 'warning' ? 'bg-orange-400' : 'bg-blue-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getSeverityBgColor(alert.severity)}`}>{alert.severity}</span>
                      <span className="text-[10px] text-gray-400">{formatRelativeDate(alert.created_at)}</span>
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


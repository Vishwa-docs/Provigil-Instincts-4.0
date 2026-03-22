import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Gauge,
  MapPin,
  Bell,
  ClipboardList,
  Shield,
  ChevronLeft,
  ChevronRight,
  Activity,
  Box,
  HelpCircle,
  BookOpen,
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import MeterFleet from './pages/MeterFleet';
import MeterDetail from './pages/MeterDetail';
import MapView from './pages/MapView';
import Alerts from './pages/Alerts';
import WorkOrders from './pages/WorkOrders';
import DigitalTwin from './pages/DigitalTwin';
import HowItWorks from './pages/HowItWorks';
import GuidedTour from './components/GuidedTour';
import { dashboardAPI } from './services/api';

const navItems = [
  { path: '/', label: 'How It Works', icon: BookOpen },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/meters', label: 'Meter Fleet', icon: Gauge },
  { path: '/map', label: 'Network Map', icon: MapPin },
  { path: '/digital-twin', label: 'Digital Twin', icon: Box },
  { path: '/alerts', label: 'Alerts', icon: Bell },
  { path: '/workorders', label: 'Work Orders', icon: ClipboardList },
];

function Sidebar({ collapsed, setCollapsed, onStartTour }) {
  const location = useLocation();
  const [systemOnline, setSystemOnline] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function checkHealth() {
      try {
        await dashboardAPI.getStats();
        if (mounted) setSystemOnline(true);
      } catch {
        if (mounted) setSystemOnline(false);
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);



  return (
    <aside
      className={`fixed top-0 left-0 h-screen z-30 flex flex-col bg-white/95 backdrop-blur-xl border-r border-gray-200/80 transition-all duration-300 ${
        collapsed ? 'w-[68px]' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-100 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-[#0071E3] flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold tracking-tight leading-tight">
              <span className="text-[#0071E3]">ProVigil</span>
            </h1>
            <p className="text-xs font-semibold text-gray-500 tracking-wide leading-tight">
              INSTINCTS 4.0
            </p>
          </div>
        )}
      </div>

      {/* Nav Links */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive =
            path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(path);

          return (
            <NavLink
              key={path}
              to={path}
              data-tour={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-blue-50 text-[#0071E3] font-semibold'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
              title={collapsed ? label : undefined}
            >
              <Icon
                className={`w-5 h-5 shrink-0 ${
                  isActive ? 'text-[#0071E3]' : 'text-gray-400 group-hover:text-gray-600'
                }`}
              />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Take a Tour Button */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <button
            onClick={onStartTour}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 hover:text-[#0071E3] hover:bg-blue-50 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Take a Tour</span>
          </button>
        </div>
      )}

      {/* System Status Footer */}
      {!collapsed && (
        <div className="px-3 pb-3">
          <div className="p-3 rounded-xl bg-gray-50/80 border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${systemOnline === null ? 'bg-gray-400 animate-pulse' : systemOnline ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className={`text-xs font-medium ${systemOnline === null ? 'text-gray-400' : systemOnline ? 'text-green-600' : 'text-red-500'}`}>
                {systemOnline === null ? 'Connecting...' : systemOnline ? 'System Online' : 'System Offline'}
              </span>
            </div>
            <p className="text-[10px] text-gray-400">{systemOnline ? 'Fleet intelligence active' : 'Check backend connection'}</p>

          </div>
        </div>
      )}

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-gray-100 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </aside>
  );
}

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [runTour, setRunTour] = useState(false);

  const handleStartTour = useCallback(() => setRunTour(true), []);
  const handleTourEnd = useCallback(() => setRunTour(false), []);

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <GuidedTour run={runTour} onFinish={handleTourEnd} />
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} onStartTour={handleStartTour} />

      <main
        className={`transition-all duration-300 ${
          collapsed ? 'ml-[68px]' : 'ml-60'
        }`}
      >
        <div className="p-6 max-w-[1600px] mx-auto">
          <Routes>
            <Route path="/" element={<HowItWorks />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/meters" element={<MeterFleet />} />
            <Route path="/meters/:id" element={<MeterDetail />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/digital-twin" element={<DigitalTwin />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/workorders" element={<WorkOrders />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

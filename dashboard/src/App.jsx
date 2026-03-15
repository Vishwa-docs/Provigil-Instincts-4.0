import { useState } from 'react';
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
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import MeterFleet from './pages/MeterFleet';
import MeterDetail from './pages/MeterDetail';
import MapView from './pages/MapView';
import Alerts from './pages/Alerts';
import WorkOrders from './pages/WorkOrders';
import DigitalTwin from './pages/DigitalTwin';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/meters', label: 'Meter Fleet', icon: Gauge },
  { path: '/map', label: 'Network Map', icon: MapPin },
  { path: '/digital-twin', label: 'Digital Twin', icon: Box },
  { path: '/alerts', label: 'Alerts', icon: Bell },
  { path: '/workorders', label: 'Work Orders', icon: ClipboardList },
];

function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();

  return (
    <aside
      className={`fixed top-0 left-0 h-screen z-30 flex flex-col bg-navy-900 border-r border-navy-700/50 transition-all duration-300 ${
        collapsed ? 'w-[68px]' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-navy-700/50 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-base font-bold text-white tracking-tight leading-tight">
              Pro-Vigil
            </h1>
            <p className="text-[10px] text-cyan-400 font-medium tracking-widest uppercase">
              Instincts
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
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-navy-800/60 border border-transparent'
              }`}
              title={collapsed ? label : undefined}
            >
              <Icon
                className={`w-5 h-5 shrink-0 ${
                  isActive ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'
                }`}
              />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* System Status Footer */}
      {!collapsed && (
        <div className="px-3 pb-3">
          <div className="p-3 rounded-lg bg-navy-800/60 border border-navy-700/40">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">System Online</span>
            </div>
            <p className="text-[10px] text-gray-500">Fleet intelligence active</p>
          </div>
        </div>
      )}

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-navy-700/50 text-gray-500 hover:text-gray-300 hover:bg-navy-800/60 transition-colors"
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

  return (
    <div className="min-h-screen bg-navy-950">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      <main
        className={`transition-all duration-300 ${
          collapsed ? 'ml-[68px]' : 'ml-60'
        }`}
      >
        <div className="p-6 max-w-[1600px] mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
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

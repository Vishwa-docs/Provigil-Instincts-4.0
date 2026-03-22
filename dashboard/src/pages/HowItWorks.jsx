import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Thermometer, Zap, Activity, Network, Battery, Cpu,
  ArrowRight, Shield, AlertTriangle, Wifi, Monitor, Radio,
  Wrench, Eye, TrendingDown, Server, Camera, Globe, MapPin,
  BrainCircuit, LayoutDashboard,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import ArchitectureDiagram from '../components/ArchitectureDiagram';

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.35 } }),
};

const INNOVATIONS = [
  { icon: Camera, color: '#FF3B30', bg: 'bg-red-50', title: 'Vision Language Models (VLMs)', desc: 'GPT-4o analyzes geo-tagged field photos and installation images to detect physical anomalies — loose wiring, corrosion, tampered seals — complementing telemetry-based ML with visual intelligence.' },
  { icon: Network, color: '#AF52DE', bg: 'bg-purple-50', title: 'Network Intelligence', desc: 'Peer mesh consensus compares voltage and power quality across feeders and transformers to separate local meter faults from grid-wide events. Topology-aware analysis at feeder → transformer → meter hierarchy.' },
  { icon: Globe, color: '#0071E3', bg: 'bg-blue-50', title: 'Localized ML Models', desc: 'Models trained on region-specific data — Indian voltage standards (CEA 207–253V ±10%), monsoon-correlated failure patterns, rural vs urban load profiles. Not generic models — tuned for Indian DISCOM conditions.' },
  { icon: Cpu, color: '#FF9500', bg: 'bg-orange-50', title: 'VOC Gas Sensor Hardware', desc: 'MOX gas sensor (SGP40) detects volatile organic compounds released during arcing and terminal overheating — a physical early-warning signal invisible to standard electrical telemetry. Retrofit-compatible.' },
  { icon: BrainCircuit, color: '#34C759', bg: 'bg-green-50', title: 'Edge ML Scoring', desc: 'Lightweight anomaly detection runs on the meter\'s embedded processor for real-time scoring. Reduces cloud dependency, enables offline fault detection, and cuts bandwidth with store-and-forward telemetry.' },
  { icon: MapPin, color: '#5AC8FA', bg: 'bg-cyan-50', title: 'GIS-Aware Clustering', desc: 'Geographic clustering correlates failures by location — identifying surge-prone zones, high-harmonic feeders, and installation-quality hotspots. Drives targeted crew deployment and infrastructure upgrades.' },
  { icon: Wrench, color: '#FF2D55', bg: 'bg-pink-50', title: 'LLM-Powered Work Orders', desc: 'GPT-4o generates technician-ready work orders with root cause analysis, parts list, estimated duration, and step-by-step instructions — turning raw ML alerts into actionable field tasks.' },
  { icon: Shield, color: '#5856D6', bg: 'bg-indigo-50', title: 'Digital Twin Per Meter', desc: 'Six-component health model independently scores terminals, relay, battery/RTC, power supply, display, and comms module. Each component has its own ML degradation curve and remaining-life prediction.' },
];

const DETECTION_METHODS = [
  { icon: Thermometer, color: '#FF3B30', bg: 'bg-red-50', title: 'Thermal & VOC Detection', desc: 'ML model detects loose-terminal faults via I²R heating patterns and VOC gas sensor (arcing byproduct detection). Catches installation defects and loosening screws before terminal burning occurs.' },
  { icon: Zap, color: '#FF9500', bg: 'bg-orange-50', title: 'Relay Chatter Analysis', desc: 'ML model analyzes microsecond transient noise to predict mechanical contact wear before relay failure. Heavy loads (motors, welding) cause latching relay faults — detected early through switching pattern analysis.' },
  { icon: Activity, color: '#0071E3', bg: 'bg-blue-50', title: 'Harmonic Threat / THD', desc: 'ML model tracks THD drift to predict power supply degradation from industrial harmonic sources. High harmonics and repeated surges cause cumulative aging — quantified as a risk driver for targeted replacement.' },
  { icon: Network, color: '#AF52DE', bg: 'bg-purple-50', title: 'Peer Mesh Consensus', desc: 'AI compares voltage across feeders to isolate local faults (loose connection) from grid-wide events (transformer/feeder issue). Works with existing telemetry — no additional hardware required.' },
  { icon: Battery, color: '#34C759', bg: 'bg-green-50', title: 'Battery Discharge Profiling', desc: 'Discharge curve ML model predicts battery end-of-life and enables cluster-optimized replacement scheduling. Avoids boot/relay failures during power outages by proactive replacement.' },
  { icon: Wifi, color: '#5AC8FA', bg: 'bg-cyan-50', title: 'Communication Health', desc: 'Detects comms degradation before blackout by correlating signal strength, packet loss, and neighbor consensus. Creates degraded-mode workflows (store-and-forward, reduced payload) to maintain visibility.' },
];

const PROBLEM_SOLUTIONS = [
  {
    problem: 'Meter failures are reactive — delays in reconnection',
    solution: 'Predict impending failure early and trigger prioritized preventive work so reconnection delays reduce.',
    features: 'Health scoring pipeline, Digital Twin health index forecasting, remaining life / outage likelihood on dashboard, automated prioritized alerts.',
    icon: TrendingDown,
    color: 'text-red-500',
  },
  {
    problem: 'Communication blackouts prevent timely monitoring and remote operations',
    solution: 'Detect comms degradation before blackout; create a degraded-mode workflow (store-and-forward, reduced payload, field check).',
    features: 'Comms degradation alarms correlating RSSI/SINR/packet loss with neighbor consensus, minimal telemetry to save bandwidth, dashboard comms health view.',
    icon: Wifi,
    color: 'text-cyan-500',
  },
  {
    problem: '"Just-in-time" maintenance — no health-based triggering; service too late or fixed cycles',
    solution: 'Condition-based maintenance: trigger service only when predicted risk crosses thresholds; avoid unnecessary replacements.',
    features: 'Fleet analytics + risk scoring, work-order auto-generation with ML-driven priority and AI summary, scalable analytics.',
    icon: Wrench,
    color: 'text-blue-500',
  },
  {
    problem: 'Poor installation / loose screws causing terminal burning — not reliably detected',
    solution: 'Catch installation defects early (post-install + first weeks), predict loosening/overheating risk from electrical + VOC signatures.',
    features: 'Geo-tagged photo/video + VLM checks, peer consensus to separate grid-wide dips vs local wiring issues, micro voltage drop + VOC anomaly as proxy for contact deterioration.',
    icon: AlertTriangle,
    color: 'text-orange-500',
  },
  {
    problem: 'High harmonics / power quality distortions cause meter malfunction',
    solution: 'Detect harmonic/power-quality stress and flag meters/feeders at risk; recommend mitigations (filtering, capacitor bank, ruggedized meter).',
    features: 'Harmonic signature detection and predictive alert, PQ & harmonic analytics, feeder heatmaps + geographic clustering.',
    icon: Activity,
    color: 'text-purple-500',
  },
  {
    problem: 'High surges / spikes damage meter power supply',
    solution: 'Identify surge events and "surge-prone" locations; preemptively schedule replacement or ruggedization where risk persists.',
    features: 'Drift / power supply aging detection from telemetry trends, demand-response synergy to reduce stress until maintenance.',
    icon: Zap,
    color: 'text-yellow-600',
  },
  {
    problem: 'Repeated surges + harmonics over time degrade internal circuitry (cumulative aging / drift)',
    solution: 'Model long-term degradation (drift + increasing noise + changing error distributions) and estimate remaining useful life per meter.',
    features: 'Digital Twin health score combining electrical telemetry + fleet context, time-series anomaly detection + trend features, remaining life prediction.',
    icon: Server,
    color: 'text-gray-600',
  },
  {
    problem: 'Heavy loads (motors, welding) cause latching relay faults',
    solution: 'Predict relay stress events and recommend operational mitigations (meter class upgrade, targeted inspection, relay checks).',
    features: 'Anomaly signatures for welding/arching harmonics, motor start signature detection, failsafe mode to avoid bad disconnects.',
    icon: Cpu,
    color: 'text-indigo-500',
  },
  {
    problem: 'Display faults — firmware becomes unusable',
    solution: 'Predict "soft brick" risk and prevent it with remote self-healing (reset / rollback) before the display or firmware becomes unusable.',
    features: 'Execution-time / heap drift monitoring over months, on-device anomaly detection + self-heal workflows, secure remote update + rollback.',
    icon: Monitor,
    color: 'text-pink-500',
  },
  {
    problem: 'Battery faults — battery failure during outages',
    solution: 'Predict battery end-of-life and schedule replacement + inventory planning; avoid boot/relay failures during outages.',
    features: 'Battery-life prediction and replacement optimizer, environmental compensation, dashboard replacement schedules.',
    icon: Battery,
    color: 'text-green-600',
  },
  {
    problem: 'No actionable field work orders from detections',
    solution: 'Turn detections into technician-ready, prioritized work orders with evidence, probable cause, and "what to check".',
    features: 'LLM summarization + structured templates, agentic workflow for triage and assignment, GIS + severity scoring.',
    icon: Wrench,
    color: 'text-blue-600',
  },
  {
    problem: 'Many meters lack PQ / temperature / mechanical sensing — early faults stay hidden',
    solution: 'Best-effort inference from existing telemetry + fleet consensus; optionally add compliant low-cost sensors only if allowed.',
    features: 'Infer PQ stress from available voltage/current statistics + neighbor consensus. Optional: retrofit MEMS vibration + temperature / VOC gas detector for terminal heating and mechanical wear.',
    icon: Eye,
    color: 'text-teal-500',
  },
];

export default function HowItWorks() {
  return (
    <>
      {/* Top Dashboard Link */}
      <Link
        to="/dashboard"
        className="mb-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#0071E3] bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
      >
        <LayoutDashboard className="w-4 h-4" />
        Go to Dashboard
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>

      <PageHeader
        title="How ProVigil Works"
        subtitle="What makes us different — and the 12 DISCOM problems we solve"
      />

      {/* What Makes Us Different */}
      <div className="mb-8">
        <h3 data-tour="innovation-cards" className="text-base font-bold text-gray-900 mb-1">What Makes Us Different</h3>
        <p className="text-xs text-gray-400 mb-4">Capabilities beyond standard AMI platforms — purpose-built for Indian DISCOM conditions.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {INNOVATIONS.map(({ icon: IIcon, color, bg, title, desc }, i) => (
            <motion.div
              key={title}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all duration-200 group"
            >
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <IIcon className="w-5 h-5" style={{ color }} />
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-1">{title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Six AI Detection Methods */}
      <div data-tour="detection-methods" className="mb-8">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Six AI Detection Methods</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DETECTION_METHODS.map(({ icon: IIcon, color, bg, title, desc }, i) => (
            <motion.div
              key={title}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all duration-200 group"
            >
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <IIcon className="w-5 h-5" style={{ color }} />
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-1">{title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Detection Parameter Table */}
      <div className="mb-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Detection Parameters & Hardware</h3>
        <p className="text-xs text-gray-400 mb-4">Each detection method uses trained ML models on specific telemetry parameters to predict failures before they occur.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 pr-4 text-gray-500 font-semibold">Fault Type</th>
                <th className="text-left py-2 pr-4 text-gray-500 font-semibold">Parameters Monitored</th>
                <th className="text-left py-2 pr-4 text-gray-500 font-semibold">Detection Method</th>
                <th className="text-left py-2 text-gray-500 font-semibold">Hardware</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              <tr className="border-b border-gray-50">
                <td className="py-2.5 pr-4 font-medium text-gray-800">Loose Terminal</td>
                <td className="py-2.5 pr-4">Temperature, VOC ppm, I²R correlation</td>
                <td className="py-2.5 pr-4">Thermal anomaly ML + VOC gas sensor</td>
                <td className="py-2.5">MOX gas sensor (SGP40)</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-2.5 pr-4 font-medium text-gray-800">Relay Wear</td>
                <td className="py-2.5 pr-4">Relay chatter (ms), switching frequency</td>
                <td className="py-2.5 pr-4">Transient noise ML model</td>
                <td className="py-2.5">Existing meter relay</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-2.5 pr-4 font-medium text-gray-800">Power Supply Degradation</td>
                <td className="py-2.5 pr-4">THD %, Power Factor, Harmonic index</td>
                <td className="py-2.5 pr-4">Harmonic drift ML model</td>
                <td className="py-2.5">Existing meter ADC</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-2.5 pr-4 font-medium text-gray-800">Voltage Anomaly</td>
                <td className="py-2.5 pr-4">Voltage (207–253V CEA range)</td>
                <td className="py-2.5 pr-4">Peer mesh consensus + ML scoring</td>
                <td className="py-2.5">Existing meter + network</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-2.5 pr-4 font-medium text-gray-800">Battery Failure</td>
                <td className="py-2.5 pr-4">Battery voltage, discharge curve</td>
                <td className="py-2.5 pr-4">Discharge curve ML prediction</td>
                <td className="py-2.5">Existing RTC battery</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-medium text-gray-800">Communication Loss</td>
                <td className="py-2.5 pr-4">Signal strength, packet loss, uptime</td>
                <td className="py-2.5 pr-4">Connectivity pattern ML model</td>
                <td className="py-2.5">Existing RF/cellular modem</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Problem → Solution Mapping */}
      <div data-tour="problem-solutions" className="mb-8">
        <h3 className="text-base font-bold text-gray-900 mb-1">Problems We Solve</h3>
        <p className="text-xs text-gray-400 mb-4">Every DISCOM pain point mapped to our detection capabilities and specific platform features.</p>
        <div className="space-y-3">
          {PROBLEM_SOLUTIONS.map(({ problem, solution, features, icon: PIcon, color }, i) => (
            <motion.div
              key={i}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="shrink-0 mt-0.5">
                  <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center">
                    <PIcon className={`w-4.5 h-4.5 ${color}`} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-red-700 mb-1">Problem: {problem}</p>
                  <p className="text-sm text-green-700 mb-2"><span className="font-semibold">Solution:</span> {solution}</p>
                  <p className="text-xs text-gray-500 leading-relaxed"><span className="font-medium text-gray-600">How:</span> {features}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* System Architecture (toggleable) */}
      <ArchitectureDiagram />

      {/* Go to Dashboard */}
      <div className="text-center pb-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#0071E3] hover:text-blue-700 transition-colors"
        >
          <LayoutDashboard className="w-4 h-4" />
          Go to Dashboard
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </>
  );
}

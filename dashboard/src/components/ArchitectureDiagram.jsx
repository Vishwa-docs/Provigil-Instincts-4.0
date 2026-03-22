import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';

/* ── palette ── */
const P = {
  bg: '#0f172a',
  edge: { fill: '#10233f', stroke: '#5ab0ff', text: '#dbeafe' },
  cloud: { fill: '#17395c', stroke: '#5fd1b3', text: '#d1fae5' },
  intel: { fill: '#3a2753', stroke: '#c697ff', text: '#ede9fe' },
  model: { fill: '#312e44', stroke: '#a78bfa', text: '#e0d9ff' },
  output: { fill: '#182f4d', stroke: '#78d9ff', text: '#e0f2fe' },
  data: { fill: '#3b2c1f', stroke: '#ffbf73', text: '#fef3c7' },
  ext: { fill: '#4b1f1f', stroke: '#ff8c8c', text: '#fee2e2' },
  muted: '#64748b',
  flow: '#3b82f6',
};

/* column layout constants */
const COL = { gap: 12, pad: 12 };
const C1 = { x: 16, w: 184 };                         // Edge
const C2 = { x: C1.x + C1.w + COL.gap, w: 260 };     // Cloud (212)
const C3 = { x: C2.x + C2.w + COL.gap, w: 210 };     // Intelligence (484)
const C4 = { x: C3.x + C3.w + COL.gap, w: 170 };     // Operator (706)
const SVG_W = C4.x + C4.w + 16;                        // ~892
const SVG_H = 560;

/* ── primitives ── */
const Tag = ({ x, y, w, h, p, label, sub, rx = 8 }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={rx}
      fill={p.fill} stroke={p.stroke} strokeWidth={1.4} />
    <text x={x + w / 2} y={y + (sub ? h / 2 - 4 : h / 2 + 4)}
      textAnchor="middle" fill={p.text} fontSize={10.5} fontWeight={600}
      fontFamily="system-ui, sans-serif">{label}</text>
    {sub && (
      <text x={x + w / 2} y={y + h / 2 + 9}
        textAnchor="middle" fill={p.text} fontSize={8} fontWeight={400}
        opacity={0.62} fontFamily="system-ui, sans-serif">{sub}</text>
    )}
  </g>
);

const Section = ({ x, y, w, h, label, color }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={10}
      fill={color + '06'} stroke={color} strokeWidth={1} strokeDasharray="5 3" opacity={0.45} />
    <text x={x + 10} y={y + 14} fill={color} fontSize={8.5} fontWeight={700}
      letterSpacing={0.6} fontFamily="system-ui, sans-serif">{label}</text>
  </g>
);

const FlowArrow = ({ x1, y1, x2, y2, color = P.flow }) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2}
    stroke={color} strokeWidth={2} markerEnd="url(#fa)" opacity={0.6} />
);

export default function ArchitectureDiagram() {
  const [open, setOpen] = useState(true);

  /* inner box x / widths for each column */
  const ix1 = C1.x + COL.pad;
  const iw1 = C1.w - COL.pad * 2;
  const ix2 = C2.x + COL.pad;
  const iw2 = C2.w - COL.pad * 2;
  const ix3 = C3.x + COL.pad;
  const iw3 = C3.w - COL.pad * 2;
  const ix4 = C4.x + COL.pad;
  const iw4 = C4.w - COL.pad * 2;

  /* vertical positions — uniform grid */
  const row = (n) => 32 + n * 46;

  return (
    <div className="mb-8">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 hover:shadow-md transition-all duration-200 cursor-pointer group"
      >
        <div className="text-left">
          <h3 className="text-base font-bold text-gray-900">System Architecture</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            End-to-end pipeline — edge, cloud, intelligence, and operator layers.
          </p>
        </div>
        {open
          ? <ChevronUp className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
          : <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
        }
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="arch-svg"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="bg-[#0f172a] rounded-2xl shadow-lg border border-gray-800 mt-3 p-3 sm:p-4 overflow-x-auto">
              <svg
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                xmlns="http://www.w3.org/2000/svg"
                className="w-full"
                style={{ minWidth: 640 }}
              >
                <defs>
                  <marker id="fa" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
                    <path d="M0,0.5 L6,2.5 L0,4.5" fill={P.flow} opacity={0.6} />
                  </marker>
                </defs>

                {/* ──── COL 1: EDGE ──── */}
                <Section x={C1.x} y={8} w={C1.w} h={520} label="EDGE LAYER" color={P.edge.stroke} />
                <Tag x={ix1} y={row(0)} w={iw1} h={42} p={P.edge}
                  label="Smart Meters" sub="DLMS / COSEM telemetry" />
                <Tag x={ix1} y={row(1)} w={iw1} h={42} p={P.edge}
                  label="ESP32 + Sensors" sub="CT clamp · MOX (SGP40) · NTC" />
                <Tag x={ix1} y={row(2)} w={iw1} h={42} p={P.edge}
                  label="TinyML Inference" sub="< 1 ms on-device scoring" />
                <Tag x={ix1} y={row(3)} w={iw1} h={42} p={P.edge}
                  label="Mobile App" sub="Expo · Camera · VLM" />

                {/* ──── COL 2: CLOUD ──── */}
                <Section x={C2.x} y={8} w={C2.w} h={520} label="CLOUD PLATFORM" color={P.cloud.stroke} />
                <Tag x={ix2} y={row(0)} w={iw2} h={42} p={P.cloud}
                  label="FastAPI" sub="Ingest · Fleet · Alerts · AI / Vision APIs" />
                <Tag x={ix2} y={row(1)} w={iw2} h={42} p={P.ext}
                  label="Mosquitto · Azure OpenAI GPT-4o · Gmail SMTP" />
                <Tag x={ix2} y={row(2)} w={iw2} h={42} p={P.cloud}
                  label="Scoring Engine" sub="17 rules — IEC 62052 · CEA · IS 15959" />
                <Tag x={ix2} y={row(3)} w={iw2} h={42} p={P.cloud}
                  label="Alerting + Email" sub="Priority workflow · subscriber notify" />
                <Tag x={ix2} y={row(4)} w={iw2} h={42} p={P.cloud}
                  label="Scheduler · Scenario Pipeline" sub="APScheduler · one-click fault inject" />
                <Tag x={ix2} y={row(5)} w={iw2} h={42} p={P.data}
                  label="SQLite" sub="meters · readings · alerts · work orders" />

                {/* ──── COL 3: INTELLIGENCE ──── */}
                <Section x={C3.x} y={8} w={C3.w} h={520} label="INTELLIGENCE" color={P.intel.stroke} />
                <Tag x={ix3} y={row(0)} w={iw3} h={42} p={P.intel}
                  label="Digital Twin" sub="6-component per meter" />
                <Tag x={ix3} y={row(1)} w={iw3} h={42} p={P.intel}
                  label="Network Intelligence" sub="Feeder → Transformer consensus" />
                <Tag x={ix3} y={row(2)} w={iw3} h={42} p={P.intel}
                  label="LLM Work Orders" sub="GPT-4o root cause + action" />
                <Tag x={ix3} y={row(3)} w={iw3} h={42} p={P.intel}
                  label="NVIDIA Cosmos VLM" sub="Loose wire visual detection" />
                {/* ML models */}
                <text x={ix3 + iw3 / 2} y={row(4) + 4} textAnchor="middle"
                  fill={P.model.stroke} fontSize={8} fontWeight={700}
                  fontFamily="system-ui, sans-serif" letterSpacing={0.5}>ML MODELS</text>
                <Tag x={ix3} y={row(4) + 10} w={iw3} h={36} p={P.model}
                  label="LSTM-Autoencoder" sub="Learned normal pattern per meter" />
                <Tag x={ix3} y={row(5) + 4} w={iw3} h={36} p={P.model}
                  label="Temporal Fusion Transformer" sub="30-day health forecasting" />
                <Tag x={ix3} y={row(6) - 2} w={iw3} h={36} p={P.model}
                  label="Graph Neural Network" sub="Network anomaly propagation" />
                <Tag x={ix3} y={row(7) - 8} w={iw3} h={36} p={P.model}
                  label="Isolation Forest" sub="Unsupervised outlier detection" />
                <Tag x={ix3} y={row(8) - 14} w={iw3} h={36} p={P.model}
                  label="XGBoost Classifier" sub="Multi-fault classification" />

                {/* ──── COL 4: OPERATOR ──── */}
                <Section x={C4.x} y={8} w={C4.w} h={520} label="OPERATOR LAYER" color={P.output.stroke} />
                <Tag x={ix4} y={row(0)} w={iw4} h={42} p={P.output}
                  label="Web Dashboard" sub="Fleet · Alerts · Map · Twin" />
                <Tag x={ix4} y={row(1)} w={iw4} h={42} p={P.output}
                  label="Email Alerts" sub="Real-time notifications" />
                <Tag x={ix4} y={row(2)} w={iw4} h={42} p={P.output}
                  label="AI Work Orders" sub="Auto-generated + prioritized" />
                <Tag x={ix4} y={row(3)} w={iw4} h={42} p={P.output}
                  label="Mobile Inspector" sub="Field VLM validation" />
                <Tag x={ix4} y={row(4)} w={iw4} h={42} p={P.output}
                  label="Nginx + HTTPS" sub="Let's Encrypt SSL" />

                {/* ──── FLOW ARROWS (only 3) ──── */}
                <FlowArrow x1={C1.x + C1.w} y1={row(2) + 21} x2={C2.x} y2={row(2) + 21} />
                <FlowArrow x1={C2.x + C2.w} y1={row(2) + 21} x2={C3.x} y2={row(2) + 21} />
                <FlowArrow x1={C3.x + C3.w} y1={row(1) + 21} x2={C4.x} y2={row(1) + 21} />

                {/* ──── LEGEND ──── */}
                <g transform={`translate(${C1.x + COL.pad}, 536)`}>
                  {[
                    { label: 'Edge / Field', c: P.edge },
                    { label: 'Cloud Platform', c: P.cloud },
                    { label: 'Intelligence / AI', c: P.intel },
                    { label: 'ML Models', c: P.model },
                    { label: 'Operator UI', c: P.output },
                    { label: 'Data Store', c: P.data },
                    { label: 'External', c: P.ext },
                  ].map(({ label, c }, i) => (
                    <g key={label} transform={`translate(${i * 122}, 0)`}>
                      <rect x={0} y={0} width={12} height={10} rx={3}
                        fill={c.fill} stroke={c.stroke} strokeWidth={1} />
                      <text x={17} y={9} fill={P.muted} fontSize={8}
                        fontFamily="system-ui, sans-serif">{label}</text>
                    </g>
                  ))}
                </g>
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


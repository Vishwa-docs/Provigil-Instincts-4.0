import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { dashboardAPI } from '../services/api';

const COOLDOWN_SEC = 30;

export default function ScenarioTrigger({ onTriggered }) {
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [result, setResult] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleTrigger = useCallback(async () => {
    if (cooldown > 0 || status === 'loading') return;
    setStatus('loading');
    setResult(null);
    setErrorMsg('');
    setDetailOpen(false);
    try {
      const res = await dashboardAPI.triggerScenario();
      setResult(res.data);
      setStatus('success');
      setCooldown(COOLDOWN_SEC);
      onTriggered?.();
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.response?.data?.detail || 'Failed to run detection cycle. Please try again.');
    }
  }, [cooldown, status, onTriggered]);

  const isDisabled = status === 'loading' || cooldown > 0;

  return (
    <div data-tour="scenario-trigger" className="space-y-3">
      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
        <p className="text-xs font-semibold text-amber-800 mb-1">Fault Scenario: Sudden Thermal Overload + Gas Emission</p>
        <p className="text-[11px] text-amber-700 leading-relaxed">Injects a progressive loose-terminal fault on a live meter — temperature rises from 42°C→62°C due to I²R heating, VOC gas jumps from 8→128 ppm (arcing byproduct), THD exceeds CEA 5% limit, relay chatter degrades, battery drops below threshold, and power factor falls. Six concurrent fault signatures are detected by the ML pipeline.</p>
      </div>
      <button
        onClick={handleTrigger}
        disabled={isDisabled}
        className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm ${
          isDisabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-[#0071E3] hover:bg-[#0077ED] text-white hover:shadow-md'
        }`}
      >
        {status === 'loading' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Zap className="w-4 h-4" />
        )}
        {status === 'loading'
          ? 'Detecting...'
          : cooldown > 0
            ? `Wait ${cooldown}s`
            : 'Run Fault Detection'}
      </button>

      {status === 'success' && result && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">
              Fault detected on {result.meter_id}
            </span>
          </div>

          {result.detection_method && (
            <p className="text-xs text-gray-600 mb-3 leading-relaxed">{result.detection_method}</p>
          )}

          {result.parameters_changed?.length > 0 && (
            <div className="mb-3">
              <button
                onClick={() => setDetailOpen(!detailOpen)}
                className="flex items-center gap-1 text-xs font-medium text-[#0071E3] hover:text-blue-700 transition-colors"
              >
                {detailOpen ? <ChevronUp className="w-3.5 h-3.5"/> : <ChevronDown className="w-3.5 h-3.5"/>}
                {detailOpen ? 'Hide' : 'View'} Detection Parameters ({result.parameters_changed.length})
              </button>
              {detailOpen && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {result.parameters_changed.map((param, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-white border border-green-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-800">{param.parameter}</span>
                        <span className="text-[10px] text-gray-400">{param.from_val} → {param.to_val}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-relaxed">{param.significance}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 text-xs">
            <Link to="/alerts" className="text-[#0071E3] hover:underline font-medium">View Alert →</Link>
            <Link to="/workorders" className="text-[#0071E3] hover:underline font-medium">View Work Order →</Link>
            <Link to={`/meters/${result.meter_id}`} className="text-[#0071E3] hover:underline font-medium">View Meter →</Link>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700">{errorMsg}</span>
        </div>
      )}
    </div>
  );
}

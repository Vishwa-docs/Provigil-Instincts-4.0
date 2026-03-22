import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Joyride, { STATUS, EVENTS, ACTIONS } from 'react-joyride';

const TOUR_STEPS = [
  {
    target: 'body',
    route: '/',
    content: (
      <div>
        <p className="font-semibold text-gray-900 mb-2">Welcome to ProVigil</p>
        <p className="text-sm text-gray-600 leading-relaxed">India is deploying 250 million smart meters. Failures cost DISCOMs ₹500 crore annually — and maintenance is reactive. ProVigil uses ML models to predict faults before they cause outages, using existing meter telemetry plus a VOC gas sensor for arcing detection.</p>
        <p className="text-xs text-[#0071E3] mt-3 font-medium">Let us show you how it works.</p>
      </div>
    ),
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="innovation-cards"]',
    route: '/',
    placement: 'bottom',
    content: (
      <div>
        <p className="font-semibold text-gray-900 mb-1">What Makes Us Different</p>
        <p className="text-sm text-gray-600">Vision Language Models for visual inspection, localized ML tuned for Indian DISCOM conditions, VOC gas sensor hardware for arcing detection, edge ML scoring, peer mesh network intelligence, GIS clustering, LLM-powered work orders, and per-meter digital twins.</p>
        <p className="text-xs text-gray-400 mt-2">Scroll down on this page to explore 6 detection methods, hardware details, and 12 DISCOM problems we solve.</p>
      </div>
    ),
  },
  {
    target: '[data-tour="stat-cards"]',
    route: '/dashboard',
    content: (
      <div>
        <p className="font-semibold text-gray-900 mb-1">Your Fleet at a Glance</p>
        <p className="text-sm text-gray-600">Real-time fleet health from our ML scoring engine — total meters, healthy/warning/critical counts. Watch these numbers change when you run a fault detection cycle.</p>
      </div>
    ),
  },
  {
    target: '[data-tour="scenario-trigger"]',
    route: '/dashboard',
    content: (
      <div>
        <p className="font-semibold text-gray-900 mb-1">Run Fault Detection</p>
        <p className="text-sm text-gray-600">Click to run the full ML detection pipeline on a live meter. You'll see which parameters changed (temperature, VOC, THD, etc.) and why each matters:</p>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">ML Scoring → Alert → AI Root Cause Analysis → Work Order → Email Notification</p>
      </div>
    ),
  },
  {
    target: '[data-tour="charts"]',
    route: '/dashboard',
    content: (
      <div>
        <p className="font-semibold text-gray-900 mb-1">Fleet Analytics</p>
        <p className="text-sm text-gray-600">Health distribution across your meters, fleet status breakdown, and 30-day anomaly trends. Spot systemic issues at a glance.</p>
      </div>
    ),
  },
  {
    target: '[data-tour="meter-fleet-page"]',
    route: '/meters',
    content: (
      <div>
        <p className="font-semibold text-gray-900 mb-1">Meter Fleet</p>
        <p className="text-sm text-gray-600">Drill into any meter — search by ID, name, or issue. Click a meter to see telemetry charts (including VOC gas levels), predictive maintenance forecasts, and component diagnostics.</p>
      </div>
    ),
  },
  {
    target: '[data-tour="network-map-page"]',
    route: '/map',
    content: (
      <div>
        <p className="font-semibold text-gray-900 mb-1">Network Intelligence</p>
        <p className="text-sm text-gray-600">See your grid topology — feeders, transformers, meters. Our ML-driven mesh consensus algorithm compares voltage across peers to isolate local faults from grid-wide events.</p>
      </div>
    ),
  },
  {
    target: '[data-tour="digital-twin-page"]',
    route: '/digital-twin',
    content: (
      <div>
        <p className="font-semibold text-gray-900 mb-1">Digital Twin</p>
        <p className="text-sm text-gray-600">Six components scored independently — terminals (with VOC gas sensor), relay, battery/RTC, power supply, display, and comms module. Each component's ML model pinpoints degradation.</p>
      </div>
    ),
  },
  {
    target: '[data-tour="alerts-page"]',
    route: '/alerts',
    content: (
      <div>
        <p className="font-semibold text-gray-900 mb-1">AI-Powered Alerts</p>
        <p className="text-sm text-gray-600">Prioritized alerts with GPT-4o root cause analysis. One click generates a structured work order with estimated parts, duration, and urgency.</p>
      </div>
    ),
  },
  {
    target: '[data-tour="workorders-page"]',
    route: '/workorders',
    content: (
      <div>
        <p className="font-semibold text-gray-900 mb-1">Work Orders</p>
        <p className="text-sm text-gray-600">Automated maintenance queue sorted by AI risk priority. Track status from creation through scheduling, field work, and completion.</p>
      </div>
    ),
  },
  {
    target: '[data-tour="email-subscribe"]',
    route: '/dashboard',
    content: (
      <div>
        <p className="font-semibold text-gray-900 mb-1">Subscribe for Live Alerts</p>
        <p className="text-sm text-gray-600">Enter your email to receive critical alerts in real time. Then run a fault detection cycle to see a real alert arrive in your inbox!</p>
      </div>
    ),
  },
  {
    target: 'body',
    route: '/dashboard',
    content: (
      <div>
        <p className="font-semibold text-gray-900 mb-2">You're Ready!</p>
        <p className="text-sm text-gray-600">Start by running a fault detection cycle, then explore each page to see the full predictive maintenance pipeline in action.</p>
        <p className="text-xs text-gray-500 mt-2 italic">Detect earlier. Explain better. Act faster.</p>
      </div>
    ),
    placement: 'center',
  },
];

const TOUR_STYLES = {
  options: {
    arrowColor: '#fff',
    backgroundColor: '#fff',
    overlayColor: 'rgba(0, 0, 0, 0.35)',
    primaryColor: '#0071E3',
    textColor: '#1D1D1F',
    zIndex: 10000,
    width: 380,
  },
  tooltipContainer: {
    textAlign: 'left',
  },
  buttonNext: {
    backgroundColor: '#0071E3',
    borderRadius: 12,
    fontSize: 14,
    padding: '8px 20px',
    fontWeight: 600,
  },
  buttonBack: {
    color: '#86868B',
    fontSize: 14,
  },
  buttonSkip: {
    color: '#86868B',
    fontSize: 13,
  },
  tooltip: {
    borderRadius: 18,
    padding: 24,
    maxWidth: 400,
  },
};

const STORAGE_KEY = 'provigil_tour_completed';

export default function GuidedTour({ run, onFinish }) {
  const [shouldRun, setShouldRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const pendingStepRef = useRef(null);

  // End tour helper — single place to cleanly stop everything
  const endTour = useCallback(() => {
    setShouldRun(false);
    setStepIndex(0);
    setTransitioning(false);
    pendingStepRef.current = null;
    localStorage.setItem(STORAGE_KEY, 'true');
    onFinish?.();
  }, [onFinish]);

  useEffect(() => {
    if (run) {
      setStepIndex(0);
      setTransitioning(false);
      pendingStepRef.current = null;
      const firstRoute = TOUR_STEPS[0]?.route || '/';
      if (location.pathname !== firstRoute) {
        navigate(firstRoute);
      }
      const timer = setTimeout(() => setShouldRun(true), 300);
      return () => clearTimeout(timer);
    }
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      const timer = setTimeout(() => {
        setStepIndex(0);
        setShouldRun(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [run]);

  // After route changes, resume the tour at the pending step
  useEffect(() => {
    if (pendingStepRef.current === null) return;
    const pending = pendingStepRef.current;
    pendingStepRef.current = null;
    const timer = setTimeout(() => {
      setStepIndex(pending);
      setShouldRun(true);
      setTransitioning(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Safety: if transitioning gets stuck for >2s, force-clear it
  useEffect(() => {
    if (!transitioning) return;
    const safety = setTimeout(() => {
      if (pendingStepRef.current !== null) {
        // Route didn't change — resume anyway
        const pending = pendingStepRef.current;
        pendingStepRef.current = null;
        setStepIndex(pending);
        setShouldRun(true);
      }
      setTransitioning(false);
    }, 2000);
    return () => clearTimeout(safety);
  }, [transitioning]);

  const handleCallback = useCallback((data) => {
    const { status, action, index, type } = data;

    // Handle finished/skipped from Joyride
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      endTour();
      navigate('/dashboard');
      return;
    }

    if (type === EVENTS.STEP_AFTER) {
      const nextIndex = action === ACTIONS.PREV ? index - 1 : index + 1;

      // Out of bounds — tour is done
      if (nextIndex < 0 || nextIndex >= TOUR_STEPS.length) {
        endTour();
        navigate('/dashboard');
        return;
      }

      const nextRoute = TOUR_STEPS[nextIndex].route;
      const currentRoute = location.pathname;

      if (nextRoute && nextRoute !== currentRoute) {
        // Pause tour, navigate, resume after page loads
        setShouldRun(false);
        setTransitioning(true);
        pendingStepRef.current = nextIndex;
        navigate(nextRoute);
      } else {
        setStepIndex(nextIndex);
      }
    }
  }, [navigate, location.pathname, endTour]);

  return (
    <>
      {transitioning && (
        <div className="fixed inset-0 z-[9999] bg-black/20 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-lg px-6 py-4 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-gray-700">Loading next page...</span>
          </div>
        </div>
      )}
      <Joyride
        steps={TOUR_STEPS.map(s => ({ ...s, disableBeacon: true }))}
        stepIndex={stepIndex}
        run={shouldRun}
        continuous
        showSkipButton
        showProgress
        disableCloseOnEsc={false}
        disableOverlayClose={false}
        scrollToFirstStep
        scrollOffset={100}
        callback={handleCallback}
        styles={TOUR_STYLES}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Done',
          next: 'Next',
          skip: 'Skip Tour',
        }}
      />
    </>
  );
}

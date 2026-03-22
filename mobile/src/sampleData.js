const now = '2026-03-15T11:30:00+05:30';

export const sampleMeters = [
  {
    id: 'MTR-001',
    name: 'Connaught Place Feeder 01',
    status: 'healthy',
    health_score: 0.94,
    suspected_issue: 'healthy',
    location_lat: 28.6315,
    location_lng: 77.2167,
    latest_reading: { voltage: 230.1, current: 4.2, power_factor: 0.95, temperature: 36.2, thd: 1.8, relay_chatter_ms: 3.5, battery_voltage: 3.18 },
  },
  {
    id: 'MTR-002',
    name: 'Karol Bagh Distribution 12',
    status: 'warning',
    health_score: 0.72,
    suspected_issue: 'voltage_imbalance',
    location_lat: 28.6519,
    location_lng: 77.1909,
    latest_reading: { voltage: 215.3, current: 6.8, power_factor: 0.87, temperature: 42.1, thd: 4.2, relay_chatter_ms: 12.0, battery_voltage: 2.9 },
  },
  {
    id: 'MTR-003',
    name: 'Rajouri Garden Edge Node',
    status: 'healthy',
    health_score: 0.89,
    suspected_issue: 'healthy',
    location_lat: 28.6427,
    location_lng: 77.1221,
  },
  {
    id: 'MTR-004',
    name: 'Dwarka Sector 10 Feeder',
    status: 'critical',
    health_score: 0.38,
    suspected_issue: 'relay_instability',
    location_lat: 28.5921,
    location_lng: 77.046,
    latest_reading: { voltage: 228.5, current: 18.3, power_factor: 0.78, temperature: 48.7, thd: 6.1, relay_chatter_ms: 185.0, battery_voltage: 3.05 },
  },
  {
    id: 'MTR-005',
    name: 'Rohini Grid Meter',
    status: 'healthy',
    health_score: 0.9,
    suspected_issue: 'healthy',
    location_lat: 28.7495,
    location_lng: 77.0565,
  },
  {
    id: 'MTR-006',
    name: 'Lajpat Nagar Transformer Meter',
    status: 'warning',
    health_score: 0.68,
    suspected_issue: 'battery_degradation',
    location_lat: 28.5677,
    location_lng: 77.2431,
  },
  {
    id: 'MTR-007',
    name: 'Noida Border Industrial Feed',
    status: 'healthy',
    health_score: 0.86,
    suspected_issue: 'healthy',
    location_lat: 28.5355,
    location_lng: 77.391,
  },
  {
    id: 'MTR-008',
    name: 'Mayur Vihar Revenue Meter',
    status: 'critical',
    health_score: 0.29,
    suspected_issue: 'loose_terminal_connection',
    location_lat: 28.6077,
    location_lng: 77.2943,
    latest_reading: { voltage: 198.2, current: 9.1, power_factor: 0.72, temperature: 62.5, thd: 8.9, relay_chatter_ms: 95.0, battery_voltage: 2.4 },
  },
  {
    id: 'MTR-009',
    name: 'Saket Commercial Block',
    status: 'healthy',
    health_score: 0.92,
    suspected_issue: 'healthy',
    location_lat: 28.5245,
    location_lng: 77.2066,
  },
  {
    id: 'MTR-010',
    name: 'Gurugram Perimeter Link',
    status: 'critical',
    health_score: 0.41,
    suspected_issue: 'communication_dropout',
    location_lat: 28.4595,
    location_lng: 77.0266,
  },
];

export const sampleStats = {
  total_meters: 10,
  healthy: 5,
  warning: 2,
  critical: 3,
  total_alerts_24h: 6,
  avg_health_score: 0.699,
};

export const sampleAlerts = [
  {
    id: 101,
    meter_id: 'MTR-008',
    alert_type: 'loose_connection_risk',
    message: 'Repeated voltage fluctuation and thermal signature suggest a loose terminal connection.',
    severity: 'critical',
    created_at: now,
  },
  {
    id: 102,
    meter_id: 'MTR-004',
    alert_type: 'relay_instability',
    message: 'Relay switching latency has crossed the configured tolerance range.',
    severity: 'critical',
    created_at: '2026-03-15T10:54:00+05:30',
  },
  {
    id: 103,
    meter_id: 'MTR-010',
    alert_type: 'communication_dropout',
    message: 'Intermittent upstream communication loss detected across the feeder edge.',
    severity: 'critical',
    created_at: '2026-03-15T09:42:00+05:30',
  },
  {
    id: 104,
    meter_id: 'MTR-006',
    alert_type: 'battery_health_decline',
    message: 'Battery reserve is dropping faster than expected for current environmental conditions.',
    severity: 'warning',
    created_at: '2026-03-15T08:30:00+05:30',
  },
  {
    id: 105,
    meter_id: 'MTR-002',
    alert_type: 'voltage_imbalance',
    message: 'Phase imbalance persisted across multiple intervals and now needs field inspection.',
    severity: 'warning',
    created_at: '2026-03-15T07:55:00+05:30',
  },
  {
    id: 106,
    meter_id: 'MTR-001',
    alert_type: 'localized_model_update',
    message: 'Localized model retraining completed successfully for the feeder cluster.',
    severity: 'info',
    created_at: '2026-03-15T06:10:00+05:30',
  },
];

export const sampleWorkOrders = [
  {
    id: 201,
    meter_id: 'MTR-008',
    title: 'Inspect loose terminal connection',
    priority: 'critical',
    status: 'open',
  },
  {
    id: 202,
    meter_id: 'MTR-004',
    title: 'Validate relay stability and replace if required',
    priority: 'high',
    status: 'assigned',
  },
];

const twinComponentsByMeter = {
  'MTR-008': {
    overall_health_score: 0.29,
    components: {
      terminals: { name: 'Terminals', status: 'critical', health_score: 0.22 },
      relay: { name: 'Relay', status: 'warning', health_score: 0.58 },
      battery: { name: 'Battery', status: 'healthy', health_score: 0.86 },
      comms: { name: 'Comms Module', status: 'warning', health_score: 0.64 },
      display: { name: 'Display', status: 'healthy', health_score: 0.91 },
    },
  },
  'MTR-004': {
    overall_health_score: 0.38,
    components: {
      terminals: { name: 'Terminals', status: 'warning', health_score: 0.61 },
      relay: { name: 'Relay', status: 'critical', health_score: 0.26 },
      battery: { name: 'Battery', status: 'healthy', health_score: 0.83 },
      comms: { name: 'Comms Module', status: 'healthy', health_score: 0.79 },
      display: { name: 'Display', status: 'healthy', health_score: 0.88 },
    },
  },
};

const defaultTwin = {
  overall_health_score: 0.87,
  components: {
    terminals: { name: 'Terminals', status: 'healthy', health_score: 0.9 },
    relay: { name: 'Relay', status: 'healthy', health_score: 0.88 },
    battery: { name: 'Battery', status: 'healthy', health_score: 0.84 },
    comms: { name: 'Comms Module', status: 'healthy', health_score: 0.86 },
    display: { name: 'Display', status: 'healthy', health_score: 0.91 },
  },
};

export function getSampleTwin(meterId) {
  return {
    meter_id: meterId,
    ...(twinComponentsByMeter[meterId] || defaultTwin),
  };
}

export function getSampleMeter(meterId) {
  return sampleMeters.find((meter) => meter.id === meterId) || sampleMeters[0];
}

export function getSampleSummary(meterId) {
  const meter = getSampleMeter(meterId);
  if (meter.id === 'MTR-008') {
    return {
      summary:
        'Localized scoring and network intelligence both flag this meter as high risk. The strongest indicator is a probable loose terminal connection, so the recommended action is immediate field inspection and terminal tightening.',
    };
  }

  if (meter.id === 'MTR-004') {
    return {
      summary:
        'Relay instability is the dominant failure mode. The meter should be inspected for switching wear, contact damage, and relay replacement readiness.',
    };
  }

  return {
    summary:
      `${meter.name} is currently stable. Localized model signals do not indicate immediate intervention, but continued monitoring is recommended.`,
  };
}

export const sampleNetworkTopology = {
  feeders: [
    {
      id: 'FDR-DEL-01',
      name: 'Delhi Central Feeder',
      transformers: [
        { id: 'TR-001', name: 'CP Transformer', meter_ids: ['MTR-001', 'MTR-002', 'MTR-008'] },
        { id: 'TR-002', name: 'West Grid Transformer', meter_ids: ['MTR-003', 'MTR-004', 'MTR-005'] },
      ],
    },
    {
      id: 'FDR-NCR-02',
      name: 'NCR Perimeter Feeder',
      transformers: [
        { id: 'TR-003', name: 'South Corridor Transformer', meter_ids: ['MTR-006', 'MTR-007', 'MTR-009'] },
        { id: 'TR-004', name: 'Gurugram Edge Transformer', meter_ids: ['MTR-010'] },
      ],
    },
  ],
};

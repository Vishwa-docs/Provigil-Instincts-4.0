import { Platform } from 'react-native';
import {
  sampleAlerts,
  sampleMeters,
  sampleNetworkTopology,
  sampleStats,
  sampleWorkOrders,
  getSampleMeter,
  getSampleSummary,
  getSampleTwin,
} from './sampleData';

const API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
const REQUEST_TIMEOUT_MS = 1400;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function timeout(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('timeout')), ms);
  });
}

async function fetchJson(path, options) {
  const res = await Promise.race([
    fetch(`${API_BASE_URL}${path}`, options),
    timeout(REQUEST_TIMEOUT_MS),
  ]);

  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

async function request(path, fallback) {
  try {
    return await fetchJson(path);
  } catch (error) {
    console.warn(`Using offline fallback for ${path}`, error?.message || error);
    return clone(typeof fallback === 'function' ? fallback() : fallback);
  }
}

async function post(path, body, fallback) {
  try {
    return await fetchJson(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.warn(`Using offline fallback for ${path}`, error?.message || error);
    return clone(typeof fallback === 'function' ? fallback(body) : fallback);
  }
}

export const api = {
  getDashboardStats: () => request('/api/dashboard/stats', sampleStats),
  getMeters: () => request('/api/meters/', sampleMeters),
  getMeter: (id) => request(`/api/meters/${id}`, () => getSampleMeter(id)),
  getMeterReadings: (id, limit = 48) =>
    request(`/api/meters/${id}/readings?limit=${limit}`, () => ({
      meter_id: id,
      readings: [],
      limit,
    })),
  getAlerts: () => request('/api/alerts/', sampleAlerts),
  getWorkOrders: () => request('/api/workorders/', sampleWorkOrders),
  getNetworkTopology: () => request('/api/network/topology', sampleNetworkTopology),
  getDigitalTwin: (id) => request(`/api/digital-twin/${id}`, () => getSampleTwin(id)),
  aiSummarize: (meterId) =>
    post('/api/ai/summarize', { meter_id: meterId }, () => getSampleSummary(meterId)),
  triggerScenario: () =>
    post('/api/dashboard/trigger-scenario', {}, () => ({
      meter_id: 'MTR-001',
      alert_id: 999,
      work_order_id: 999,
      message: 'Fault scenario triggered successfully',
    })),
  subscribe: (email) =>
    post('/api/dashboard/subscribe', { email }, () => ({
      email,
      subscribed_at: new Date().toISOString(),
      message: 'Subscribed successfully',
    })),
};

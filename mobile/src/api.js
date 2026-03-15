import { Platform } from 'react-native';
import {
  demoAlerts,
  demoMeters,
  demoNetworkTopology,
  demoStats,
  demoWorkOrders,
  getDemoMeter,
  getDemoSummary,
  getDemoTwin,
} from './demoData';

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
    console.warn(`Using mobile demo fallback for ${path}`, error?.message || error);
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
    console.warn(`Using mobile demo fallback for ${path}`, error?.message || error);
    return clone(typeof fallback === 'function' ? fallback(body) : fallback);
  }
}

export const api = {
  getDashboardStats: () => request('/api/dashboard/stats', demoStats),
  getMeters: () => request('/api/meters/', demoMeters),
  getMeter: (id) => request(`/api/meters/${id}`, () => getDemoMeter(id)),
  getMeterReadings: (id, limit = 48) =>
    request(`/api/meters/${id}/readings?limit=${limit}`, () => ({
      meter_id: id,
      readings: [],
      limit,
    })),
  getAlerts: () => request('/api/alerts/', demoAlerts),
  getWorkOrders: () => request('/api/workorders/', demoWorkOrders),
  getNetworkTopology: () => request('/api/network/topology', demoNetworkTopology),
  getDigitalTwin: (id) => request(`/api/digital-twin/${id}`, () => getDemoTwin(id)),
  aiSummarize: (meterId) =>
    post('/api/ai/summarize', { meter_id: meterId }, () => getDemoSummary(meterId)),
};

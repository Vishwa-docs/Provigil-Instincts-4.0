import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getHealthDistribution: () => api.get('/dashboard/health-distribution'),
  getAnomalyTrend: () => api.get('/dashboard/anomaly-trend'),
  getRecentAlerts: () => api.get('/dashboard/recent-alerts'),
};

export const metersAPI = {
  list: (status) => api.get('/meters/', { params: { status } }),
  get: (id) => api.get(`/meters/${id}`),
  getReadings: (id, start, end) => api.get(`/meters/${id}/readings`, { params: { start, end } }),
  getAnomalies: (id) => api.get(`/meters/${id}/anomalies`),
  getHealth: (id) => api.get(`/meters/${id}/health`),
  getForecast: (id, days = 7) => api.get(`/meters/${id}/forecast`, { params: { days } }),
  getRemainingLife: (id) => api.get(`/meters/${id}/remaining-life`),
};

export const alertsAPI = {
  list: (severity, skip, limit) => api.get('/alerts/', { params: { severity, skip, limit } }),
  acknowledge: (id, acknowledged = true) => api.put(`/alerts/${id}/acknowledge`, { acknowledged }),
  getStats: () => api.get('/alerts/stats'),
};

export const workOrdersAPI = {
  list: (status) => api.get('/workorders/', { params: { status } }),
  create: (data) => api.post('/workorders', data),
  update: (id, data) => api.put(`/workorders/${id}`, data),
  getPrioritized: () => api.get('/workorders/prioritized'),
};

export const networkAPI = {
  getTopology: () => api.get('/network/topology'),
  getHealth: () => api.get('/network/health'),
  getNeighbors: (meterId) => api.get(`/network/${meterId}/neighbors`),
};

export const digitalTwinAPI = {
  get: (meterId) => api.get(`/digital-twin/${meterId}`),
};

export const aiAPI = {
  summarize: (meterId, alertId) => api.post('/ai/summarize', { meter_id: meterId, alert_id: alertId }),
  generateWorkOrder: (alertId) => api.post('/ai/generate-workorder', { alert_id: alertId }),
};

export const modelAPI = {
  getStatus: () => api.get('/model/status'),
  evaluateData: (locationId) => api.get('/model/evaluate-data', { params: { location_id: locationId } }),
  retrain: (locationId) => api.post('/model/retrain', null, { params: { location_id: locationId } }),
};

export const visionAPI = {
  analyze: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/vision/analyze', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 });
  },
};

export default api;

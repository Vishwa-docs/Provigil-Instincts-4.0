import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
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
  list: (status) => api.get('/meters', { params: { status } }),
  get: (id) => api.get(`/meters/${id}`),
  getReadings: (id, start, end) => api.get(`/meters/${id}/readings`, { params: { start, end } }),
  getAnomalies: (id) => api.get(`/meters/${id}/anomalies`),
  getHealth: (id) => api.get(`/meters/${id}/health`),
};

export const alertsAPI = {
  list: (severity, skip, limit) => api.get('/alerts', { params: { severity, skip, limit } }),
  acknowledge: (id) => api.put(`/alerts/${id}/acknowledge`),
  getStats: () => api.get('/alerts/stats'),
};

export const workOrdersAPI = {
  list: (status) => api.get('/workorders', { params: { status } }),
  create: (data) => api.post('/workorders', data),
  update: (id, data) => api.put(`/workorders/${id}`, data),
  getPrioritized: () => api.get('/workorders/prioritized'),
};

export default api;

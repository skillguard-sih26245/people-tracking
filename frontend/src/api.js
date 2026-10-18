import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

export const evidenceUrl = (value, path) => {
  const url = value || (path ? `/static/evidence/${String(path).split(/[\\/]/).pop()}` : '');
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const api = {
  getHealth: async () => {
    const res = await axios.get(`${API_BASE_URL}/health`);
    return res.data;
  },

  getTargets: async () => {
    const res = await axios.get(`${API_BASE_URL}/targets`);
    return res.data;
  },

  updateTargets: async (targets) => {
    const res = await axios.post(`${API_BASE_URL}/targets`, targets);
    return res.data;
  },

  getLiveTracking: async () => {
    const res = await axios.get(`${API_BASE_URL}/live_tracking`);
    return res.data;
  },

  getAccuracyReport: async () => {
    const res = await axios.get(`${API_BASE_URL}/accuracy_report`);
    return res.data;
  },

  getPrivacyNote: async () => {
    const res = await axios.get(`${API_BASE_URL}/privacy_note`);
    return res.data;
  },

  getCentres: async () => {
    const res = await axios.get(`${API_BASE_URL}/centres`);
    return res.data;
  },

  getCentreSummary: async (centreId) => {
    const res = await axios.get(`${API_BASE_URL}/centres/${centreId}/summary`);
    return res.data;
  },

  getCentreSamples: async (centreId) => {
    const res = await axios.get(`${API_BASE_URL}/centres/${centreId}/samples`);
    return res.data;
  },

  getCentreAlerts: async (centreId) => {
    const res = await axios.get(`${API_BASE_URL}/centres/${centreId}/alerts`);
    return res.data;
  },

  runCentreAnalysis: async (centreId) => {
    const res = await axios.post(`${API_BASE_URL}/run/${centreId}`);
    return res.data;
  },

  uploadVideoForAnalysis: async ({ file, centreId, reportedAttendance, requiredInventory }) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('centre_id', centreId);
    formData.append('reported_attendance', reportedAttendance);
    formData.append('required_inventory', requiredInventory);
    const res = await axios.post(`${API_BASE_URL}/analysis/video`, formData);
    return res.data;
  },

  getAnalysisJob: async (jobId) => {
    const res = await axios.get(`${API_BASE_URL}/analysis/jobs/${jobId}`);
    return res.data;
  },

  runAllAnalysis: async () => {
    const res = await axios.post(`${API_BASE_URL}/run_all`);
    return res.data;
  },

  uploadAttendanceCsv: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`${API_BASE_URL}/attendance/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },
};

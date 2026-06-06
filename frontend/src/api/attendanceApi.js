import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 45000,
});

export async function getTodayStats() {
  const { data } = await api.get('/stats/today');
  return data;
}

export async function recognizeFace(image) {
  const { data } = await api.post('/recognize', { image });
  return data;
}

export async function registerFace(payload, onUploadProgress) {
  const { data } = await api.post('/register', payload, {
    onUploadProgress,
  });
  return data;
}

export async function getAttendanceRecords(params = {}) {
  const { data } = await api.get('/attendance', { params });
  return data;
}

export async function getMonthlyAttendanceReport(params = {}) {
  const { data } = await api.get('/attendance/monthly-report', { params });
  return data;
}

export async function getSettings() {
  const { data } = await api.get('/settings');
  return data;
}

export async function updateSettings(payload) {
  const { data } = await api.put('/settings', payload);
  return data;
}

export const getEmployeeMonthlyDetail = ({ employee_id, month, year }) =>
  axios.get('/api/attendance/employee-detail', { params: { employee_id, month, year } })
    .then((r) => r.data);
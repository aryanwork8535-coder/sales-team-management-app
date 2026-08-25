import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export const TOKEN_KEY = 'auth_token';

async function getToken() {
  return await AsyncStorage.getItem(TOKEN_KEY);
}

export async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = await getToken();
  const headers: any = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.detail || msg;
    } catch {}
    throw new Error(msg);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

export const api = {
  login: (employee_id: string, password: string) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ employee_id, password }) }),
  me: () => apiFetch('/auth/me'),
  dashboard: () => apiFetch('/dashboard/salesperson'),
  retailers: (q?: string) => apiFetch(`/retailers${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  retailer: (id: string) => apiFetch(`/retailers/${id}`),
  createRetailer: (data: any) => apiFetch('/retailers', { method: 'POST', body: JSON.stringify(data) }),
  products: (brand?: string) => apiFetch(`/products${brand ? `?brand=${encodeURIComponent(brand)}` : ''}`),
  brands: () => apiFetch('/brands'),
  startVisit: (data: any) => apiFetch('/visits/start', { method: 'POST', body: JSON.stringify(data) }),
  completeVisit: (data: any) => apiFetch('/visits/complete', { method: 'POST', body: JSON.stringify(data) }),
  visits: (retailer_id?: string) => apiFetch(`/visits${retailer_id ? `?retailer_id=${retailer_id}` : ''}`),
  createOrder: (data: any) => apiFetch('/orders', { method: 'POST', body: JSON.stringify(data) }),
  orders: (retailer_id?: string) => apiFetch(`/orders${retailer_id ? `?retailer_id=${retailer_id}` : ''}`),
  order: (id: string) => apiFetch(`/orders/${id}`),
  createCollection: (data: any) => apiFetch('/collections', { method: 'POST', body: JSON.stringify(data) }),
  collections: (retailer_id?: string) => apiFetch(`/collections${retailer_id ? `?retailer_id=${retailer_id}` : ''}`),
  schemeCalc: (items: any, retailer_id?: string) => apiFetch('/schemes/calculate', { method: 'POST', body: JSON.stringify({ items, retailer_id }) }),
  // Attendance
  attendanceToday: () => apiFetch('/attendance/today'),
  attendanceStart: (data: any) => apiFetch('/attendance/start', { method: 'POST', body: JSON.stringify(data) }),
  attendanceEnd: (data: any) => apiFetch('/attendance/end', { method: 'POST', body: JSON.stringify(data) }),
  attendanceList: (salesperson_id?: string) => apiFetch(`/attendance${salesperson_id ? `?salesperson_id=${salesperson_id}` : ''}`),
  // Expenses
  expenses: (status?: string) => apiFetch(`/expenses${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  createExpense: (data: any) => apiFetch('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  reviewExpense: (id: string, data: any) => apiFetch(`/expenses/${id}/review`, { method: 'PUT', body: JSON.stringify(data) }),
  // Complaints
  complaints: (status?: string) => apiFetch(`/complaints${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  createComplaint: (data: any) => apiFetch('/complaints', { method: 'POST', body: JSON.stringify(data) }),
  reviewComplaint: (id: string, data: any) => apiFetch(`/complaints/${id}/review`, { method: 'PUT', body: JSON.stringify(data) }),
  // Admin
  adminOverview: (range: string) => apiFetch(`/admin/overview?range=${range}`),
  adminProducts: () => apiFetch('/admin/products'),
  adminCreateProduct: (data: any) => apiFetch('/admin/products', { method: 'POST', body: JSON.stringify(data) }),
  adminUpdateProduct: (id: string, data: any) => apiFetch(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adminUsers: () => apiFetch('/admin/users'),
  adminCreateUser: (data: any) => apiFetch('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  adminUpdateUser: (id: string, data: any) => apiFetch(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adminTargets: () => apiFetch('/admin/targets'),
  adminSetTarget: (data: any) => apiFetch('/admin/targets', { method: 'POST', body: JSON.stringify(data) }),
  adminAttendanceReport: (month?: string) => apiFetch(`/admin/attendance-report${month ? `?month=${month}` : ''}`),
  // Performance
  performance: () => apiFetch('/performance'),
  // Distributor
  distributorDashboard: () => apiFetch('/distributor/dashboard'),
  schemeClaims: (status?: string) => apiFetch(`/scheme-claims${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  fulfilClaim: (id: string) => apiFetch(`/scheme-claims/${id}/fulfil`, { method: 'PUT' }),
  updateOrderStatus: (id: string, status: string) => apiFetch(`/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  // Settings & Master Data
  settings: () => apiFetch('/settings'),
  adminUpdateSettings: (data: any) => apiFetch('/admin/settings', { method: 'PUT', body: JSON.stringify(data) }),
  adminBrands: () => apiFetch('/admin/brands'),
  adminCreateBrand: (data: any) => apiFetch('/admin/brands', { method: 'POST', body: JSON.stringify(data) }),
  adminUpdateBrand: (id: string, data: any) => apiFetch(`/admin/brands/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adminTerritories: () => apiFetch('/admin/territories'),
  adminCreateTerritory: (data: any) => apiFetch('/admin/territories', { method: 'POST', body: JSON.stringify(data) }),
  adminUpdateTerritory: (id: string, data: any) => apiFetch(`/admin/territories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adminUpdateRetailer: (id: string, data: any) => apiFetch(`/admin/retailers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adminBeats: () => apiFetch('/admin/beats'),
  adminCreateBeat: (data: any) => apiFetch('/admin/beats', { method: 'POST', body: JSON.stringify(data) }),
  adminUpdateBeat: (id: string, data: any) => apiFetch(`/admin/beats/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adminSchemes: () => apiFetch('/admin/schemes'),
  adminCreateScheme: (data: any) => apiFetch('/admin/schemes', { method: 'POST', body: JSON.stringify(data) }),
  adminUpdateScheme: (id: string, data: any) => apiFetch(`/admin/schemes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

export function isNetworkError(e: any): boolean {
  const m = String(e?.message || '');
  return m.includes('Network request failed') || m.includes('Failed to fetch') || m.includes('Load failed');
}

export async function setToken(t: string | null) {
  if (t) await AsyncStorage.setItem(TOKEN_KEY, t);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

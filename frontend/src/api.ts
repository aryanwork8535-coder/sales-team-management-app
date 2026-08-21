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
  schemeCalc: (items: any) => apiFetch('/schemes/calculate', { method: 'POST', body: JSON.stringify({ items }) }),
};

export async function setToken(t: string | null) {
  if (t) await AsyncStorage.setItem(TOKEN_KEY, t);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

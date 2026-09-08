import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'mme_session_token';

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

let cachedToken: string | null = null;

export async function getToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    if (Platform.OS === 'web') {
      cachedToken = typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null;
    } else {
      cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
    }
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

export async function setToken(token: string | null) {
  cachedToken = token;
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        if (token) window.localStorage.setItem(TOKEN_KEY, token);
        else window.localStorage.removeItem(TOKEN_KEY);
      }
    } else {
      if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
      else await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch {}
}

async function request(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BACKEND_URL}/api${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

export const api = {
  exchangeSession: (session_id: string) =>
    request('/auth/session', { method: 'POST', body: JSON.stringify({ session_id }) }),
  phoneVerify: (firebase_id_token: string) =>
    request('/auth/phone-verify', { method: 'POST', body: JSON.stringify({ firebase_id_token }) }),
  me: () => request('/auth/me'),
  updateMe: (data: { hallName?: string; hallAddress?: string; ownerName?: string; ownerPhone?: string }) => request('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  deleteAccount: () => request('/auth/me', { method: 'DELETE' }),
  publicDeleteAccount: (email: string) => request('/public/delete-account', { method: 'POST', body: JSON.stringify({ email }) }),
  listBookings: () => request('/bookings'),
  createBooking: (data: any) => request('/bookings', { method: 'POST', body: JSON.stringify(data) }),
  updateBooking: (id: string, data: any) =>
    request(`/bookings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  addPayment: (id: string, amount: number) =>
    request(`/bookings/${id}/payments`, { method: 'POST', body: JSON.stringify({ amount }) }),
  deletePayment: (id: string, index: number) =>
    request(`/bookings/${id}/payments/${index}`, { method: 'DELETE' }),
  deleteBooking: (id: string) => request(`/bookings/${id}`, { method: 'DELETE' }),
  seed: () => request('/bookings/seed', { method: 'POST' }),
  // Manager Access
  listManagers: () => request('/managers'),
  addManager: (identifier: string, identifier_type: 'phone' | 'email') =>
    request('/managers', { method: 'POST', body: JSON.stringify({ identifier, identifier_type }) }),
  removeManager: (identifier: string) =>
    request(`/managers/${encodeURIComponent(identifier)}`, { method: 'DELETE' }),
};

export type Payment = { amount: number; date: string };

export type ChargeItem = { label: string; amount: number };

export type Booking = {
  id: string;
  clientName: string;
  phone: string;
  eventType: string;
  eventDate: string;
  functionTime: string;
  guestCount: number;
  totalAmount: number;
  advancePaid: number;
  payments?: Payment[];
  status: string;
  notes?: string;
  charges?: ChargeItem[];
};
